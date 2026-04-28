// src/app/admin/payments/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { sendLineAdmin, sendLineUser } from '@/lib/lineNotify';
import { sendWebPushToUser } from '@/lib/webPush';

interface Payment {
  id: string;
  amount: number;
  status: string;
  slip_url: string;
  method: string;
  created_at: string;
  user_id: string;
  users: { display_name: string; email: string; line_user_id?: string };
  subscriptions: {
    id: string;
    end_date: string;
    billing_cycle: string; // [NEW] เพิ่มรอบบิล
    products: { name: string; category: string; price: number };
  };
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<'รอตรวจสอบ' | 'สำเร็จ' | 'ยกเลิก' | 'ทั้งหมด'>('รอตรวจสอบ');

  // Modal State
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleOpenModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsModalOpen(true);
    setTimeout(() => setIsAnimating(true), 50);
  };

  const handleCloseModal = () => {
    setIsAnimating(false);
    setTimeout(() => setIsModalOpen(false), 300);
  };

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }

      await fetchPayments();
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchPayments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, amount, status, slip_url, method, created_at, user_id,
        users ( display_name, email, line_user_id ),
        subscriptions!payments_subscription_id_fkey ( 
          id, end_date, billing_cycle,
          products!subscriptions_product_id_fkey ( name, category, price ) 
        )
      `)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setPayments(data as unknown as Payment[]);
    }
    setIsLoading(false);
  };

  // ฟังก์ชันคำนวณวันหมดอายุใหม่ ให้รองรับรายเดือน/รายปี
  const calculateNewEndDate = (currentEndDate: string, billingCycle: string) => {
    const isYearly = billingCycle === 'yearly';
    const daysToAdd = isYearly ? 365 : 30;

    let baseDate = new Date();
    // ถ้าของเดิมยังไม่หมดอายุ ให้เอาวันเดิมเป็นตัวตั้งเพื่อทบยอด
    if (currentEndDate) {
      const date = new Date(currentEndDate);
      if (date > new Date()) {
        baseDate = date;
      }
    }

    baseDate.setDate(baseDate.getDate() + daysToAdd);
    return baseDate.toISOString();
  };

  // รับค่า billingCycle เข้ามาเพิ่ม
  const handleApprove = async (paymentId: string, subId: string, currentEndDate: string, billingCycle: string) => {
    setIsProcessing(true);
    try {
      const newEndDate = calculateNewEndDate(currentEndDate, billingCycle);

      // 1. อัปเดตสถานะ payment 
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'สำเร็จ' })
        .eq('id', paymentId);

      if (paymentError) throw paymentError;

      // 2. อัปเดตวันหมดอายุของ subscription
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({ end_date: newEndDate, status: 'active' })
        .eq('id', subId);

      if (subError) throw subError;

      // 3. ส่ง LINE แจ้งเตือนลูกค้า
      const paymentToApprove = payments.find(p => p.id === paymentId);
      const lineUserId = paymentToApprove?.users?.line_user_id;

      if (lineUserId) {
        const productName = paymentToApprove?.subscriptions?.products?.name || 'แพ็กเกจของคุณ';
        const formattedDate = new Date(newEndDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        const lineMessage = `✅ ยืนยันการชำระเงินสำเร็จ\n\nระบบได้ดำเนินการอนุมัติและต่ออายุแพ็กเกจให้ท่านเรียบร้อยแล้วค่ะ\n\n📦 บริการ: ${productName}\n💳 ยอดเงิน: ${paymentToApprove.amount} บาท\n📅 วันหมดอายุใหม่: ${formattedDate}\n\nหากมีข้อสงสัยเพิ่มเติม สามารถสอบถามแอดมินได้ตลอดนะคะ\n🙏 ขอบคุณที่ไว้วางใจ Codary Sub ค่ะ`;

        await sendLineUser(lineUserId, lineMessage);
      }
      
      if (paymentToApprove?.user_id) {
        await sendWebPushToUser(paymentToApprove.user_id, {
          title: 'ชำระเงินสำเร็จ! 🎉',
          body: `แอดมินอนุมัติสลิปและต่ออายุแพ็กเกจให้คุณเรียบร้อยแล้ว`
        });
      }

      handleCloseModal();

      Swal.fire({
        icon: 'success',
        title: 'อนุมัติสำเร็จ!',
        text: 'ต่ออายุแพ็กเกจให้ลูกค้าเรียบร้อยแล้ว',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

      await fetchPayments();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอนุมัติ';
      console.error('Approval error:', error);
      Swal.fire({
        icon: 'error',
        title: 'อัปเดตไม่สำเร็จ',
        text: message,
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (paymentId: string) => {
    const confirmResult = await Swal.fire({
      title: 'ยืนยันการปฏิเสธ?',
      text: "คุณต้องการปฏิเสธและยกเลิกรายการนี้ใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'ใช่, ปฏิเสธรายการ',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!confirmResult.isConfirmed) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'ยกเลิก' })
        .eq('id', paymentId);

      if (error) throw error;

      // 2. ส่ง LINE แจ้งเตือนลูกค้า
      const paymentToReject = payments.find(p => p.id === paymentId);
      const lineUserId = paymentToReject?.users?.line_user_id;

      if (lineUserId) {
        const productName = paymentToReject?.subscriptions?.products?.name || 'แพ็กเกจของคุณ';
        const lineMessage = `❌ การชำระเงินไม่ผ่านการตรวจสอบ\n\nระบบไม่สามารถตรวจสอบยอดโอนของท่านได้ หรือพบความผิดปกติในสลิปที่แนบมาค่ะ\n\n📦 บริการ: ${productName}\n💳 ยอดเงินที่แจ้ง: ${paymentToReject.amount} บาท\n\nรบกวนตรวจสอบสลิปอีกครั้ง และทำรายการแจ้งโอนใหม่ผ่านหน้าเว็บไซต์ หรือติดต่อแอดมินเพื่อขอความช่วยเหลือนนะคะ\n🙏 ขออภัยในความไม่สะดวกค่ะ`;

        await sendLineUser(lineUserId, lineMessage);
      }

      if (paymentToReject?.user_id) {
        await sendWebPushToUser(paymentToReject.user_id, {
          title: 'สลิปไม่ผ่านการตรวจสอบ ❌',
          body: `สลิปของคุณไม่ผ่านการตรวจสอบ กรุณาติดต่อแอดมินหรือส่งสลิปใหม่`
        });
      }

      handleCloseModal();

      Swal.fire({
        icon: 'success',
        title: 'ปฏิเสธรายการแล้ว',
        text: 'ปรับสถานะเป็น "ยกเลิก" เรียบร้อย',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

      await fetchPayments();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการปฏิเสธสลิป';
      console.error('Rejection error:', error);
      Swal.fire({
        icon: 'error',
        title: 'ทำรายการไม่สำเร็จ',
        text: message,
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPayments = payments.filter(p => activeTab === 'ทั้งหมด' || p.status === activeTab);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#BCE2E8] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">จัดการอนุมัติสลิป</h1>
        <p className="text-gray-500 mt-2">ตรวจสอบรายการโอนเงินและดำเนินการต่ออายุแพ็กเกจ</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {['รอตรวจสอบ', 'สำเร็จ', 'ยกเลิก', 'ทั้งหมด'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'รอตรวจสอบ' | 'สำเร็จ' | 'ยกเลิก' | 'ทั้งหมด')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:bg-gray-100'
              }`}
          >
            {tab}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">
              {payments.filter(p => tab === 'ทั้งหมด' || p.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-sm text-gray-500">
                <th className="px-6 py-4 font-medium">วันที่ทำรายการ</th>
                <th className="px-6 py-4 font-medium">ลูกค้า</th>
                <th className="px-6 py-4 font-medium">แพ็กเกจ</th>
                <th className="px-6 py-4 font-medium">ยอดโอน</th>
                <th className="px-6 py-4 font-medium">สถานะ</th>
                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(payment.created_at).toLocaleString('th-TH', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{payment.users?.display_name || 'ไม่ระบุ'}</div>
                    <div className="text-xs text-gray-500">{payment.users?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-800 font-medium">{payment.subscriptions?.products?.name || 'N/A'}</div>
                    {/* แสดงรอบบิลในตาราง */}
                    {payment.subscriptions?.billing_cycle === 'yearly' ? (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">รายปี</span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">รายเดือน</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-green-600">
                    ฿{Number(payment.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${payment.status === 'สำเร็จ' ? 'bg-[#CCF0D4] text-green-800' :
                        payment.status === 'รอตรวจสอบ' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                      }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenModal(payment)}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      ตรวจสลิป
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    ไม่พบรายการชำระเงินในหมวดหมู่นี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Approval Modal */}
      {isModalOpen && selectedPayment && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-white/90 backdrop-blur-xl border border-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 overflow-hidden">
            
            {/* --- Body: Scrollable Area --- */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
              {/* Left: Slip Image */}
              <div className="md:w-1/2 bg-gray-100 p-4 flex items-center justify-center min-h-[300px] relative border-b md:border-b-0 md:border-r border-gray-200">
                {selectedPayment.slip_url ? (
                  <img
                    src={selectedPayment.slip_url}
                    alt="Payment Slip"
                    className="max-h-[60vh] md:max-h-[500px] w-auto object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <p className="text-gray-400">ไม่มีรูปสลิป</p>
                )}
              </div>

              {/* Right: Details Area */}
              <div className="md:w-1/2 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-800">ตรวจสอบการชำระเงิน</h3>
                  <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold">ลูกค้า</label>
                    <p className="text-gray-800 font-medium">{selectedPayment.users?.display_name}</p>
                    <p className="text-xs text-gray-500">{selectedPayment.users?.email}</p>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <label className="text-xs text-gray-500 uppercase font-semibold">แพ็กเกจที่ต้องการต่ออายุ</label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-gray-800 font-bold">{selectedPayment.subscriptions?.products?.name}</p>
                      {selectedPayment.subscriptions?.billing_cycle === 'yearly' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">รายปี</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">รายเดือน</span>
                      )}
                    </div>

                    <div className="mt-2 text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <p className="text-gray-500 mb-1">วันหมดอายุเดิม: {selectedPayment.subscriptions?.end_date ? new Date(selectedPayment.subscriptions.end_date).toLocaleDateString('th-TH') : '-'}</p>
                      {selectedPayment.status === 'รอตรวจสอบ' && (
                        <p className="font-bold text-green-600">
                          ➔ ต่ออายุถึง: {new Date(calculateNewEndDate(selectedPayment.subscriptions?.end_date, selectedPayment.subscriptions?.billing_cycle)).toLocaleDateString('th-TH')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-[#BCE2E8]/20 rounded-xl border border-[#BCE2E8]/50 mt-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold">ยอดเงินที่โอน</label>
                    <p className="text-2xl font-black text-[#00C300] tracking-tight">
                      ฿{Number(selectedPayment.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Footer: Sticky Actions Area --- */}
            {selectedPayment.status === 'รอตรวจสอบ' && (
              <div className="p-4 md:p-6 border-t border-gray-100 bg-white/80 backdrop-blur-md sticky bottom-0 w-full">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReject(selectedPayment.id)}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-white border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    ปฏิเสธรายการ
                  </button>
                  <button
                    onClick={() => handleApprove(selectedPayment.id, selectedPayment.subscriptions.id, selectedPayment.subscriptions.end_date, selectedPayment.subscriptions.billing_cycle)}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-sm shadow-gray-200"
                  >
                    {isProcessing ? 'กำลังดำเนินการ...' : 'อนุมัติสลิปนี้'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}