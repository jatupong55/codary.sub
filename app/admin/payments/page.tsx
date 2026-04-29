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
                <th className="px-6 py-4 font-medium whitespace-nowrap">วันที่ทำรายการ</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">ลูกค้า</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">แพ็กเกจ</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">ยอดโอน</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">สถานะ</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                    {new Date(payment.created_at).toLocaleString('th-TH', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-semibold text-gray-800 leading-tight">{payment.users?.display_name || 'ไม่ระบุ'}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 font-normal">{payment.users?.email}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-semibold text-gray-800 leading-tight mb-1">{payment.subscriptions?.products?.name || 'N/A'}</div>
                    {payment.subscriptions?.billing_cycle === 'yearly' ? (
                      <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shadow-[inset_0_0_0_1px_rgba(147,51,234,0.1)]">รายปี</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shadow-[inset_0_0_0_1px_rgba(37,99,235,0.1)]">รายเดือน</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-green-600">
                    ฿{Number(payment.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                      className="p-2 bg-white border border-gray-200 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm active:scale-95 group"
                      title="ตรวจสอบสลิป"
                    >
                      <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
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
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-white border border-gray-100 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col transform transition-all duration-300 overflow-hidden">
            
            {/* Header - Fixed Height */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-bold text-gray-800">ตรวจสอบยอดโอน</h3>
              </div>
              <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body - Scrollable Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col md:flex-row min-h-full">
                
                {/* Left Side: Slip Image Container */}
                <div className="w-full md:w-1/2 bg-gray-100/40 p-4 md:p-6 flex items-start justify-center border-b md:border-b-0 md:border-r border-gray-100">
                  {selectedPayment.slip_url ? (
                    <div className="relative group w-full flex justify-center">
                      <img
                        src={selectedPayment.slip_url}
                        alt="Payment Slip"
                        className="max-h-[45vh] md:max-h-[500px] w-auto object-contain rounded-xl shadow-md border-2 border-white"
                      />
                      <a href={selectedPayment.slip_url} target="_blank" className="absolute bottom-2 right-2 p-2 bg-black/40 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                      <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <p className="font-medium text-sm">ไม่พบรูปสลิป</p>
                    </div>
                  )}
                </div>

                {/* Right Side: Details Area */}
                <div className="w-full md:w-1/2 p-6 flex flex-col gap-6">
                  {/* Section: Customer */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-0.5">ข้อมูลลูกค้า</p>
                      <h4 className="text-gray-800 font-bold leading-tight truncate">{selectedPayment.users?.display_name}</h4>
                      <p className="text-[11px] text-gray-500 truncate">{selectedPayment.users?.email}</p>
                    </div>
                  </div>

                  {/* Section: Subscription */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                      <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-0.5">บริการที่สมัคร</p>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-gray-800 font-bold truncate">{selectedPayment.subscriptions?.products?.name}</h4>
                        {selectedPayment.subscriptions?.billing_cycle === 'yearly' ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200">รายปี</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">รายเดือน</span>
                        )}
                      </div>
                      
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-medium">วันหมดอายุเดิม</span>
                          <span className="text-gray-600 font-bold">{selectedPayment.subscriptions?.end_date ? new Date(selectedPayment.subscriptions.end_date).toLocaleDateString('th-TH') : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] pt-2 border-t border-dashed border-gray-200">
                          <span className="text-green-600 font-bold">ต่ออายุถึง</span>
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-bold">
                            {new Date(calculateNewEndDate(selectedPayment.subscriptions?.end_date, selectedPayment.subscriptions?.billing_cycle)).toLocaleDateString('th-TH')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Amount Box */}
                  <div className="mt-auto p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-green-600/70 mb-0.5">ยอดที่ได้รับแจ้ง</p>
                      <p className="text-2xl font-black text-green-600 tracking-tighter">
                        ฿{Number(selectedPayment.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shadow-inner">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Sticky Bottom */}
            {selectedPayment.status === 'รอตรวจสอบ' && (
              <div className="p-4 md:p-6 border-t border-gray-100 bg-white flex gap-3 shrink-0">
                <button
                  onClick={() => handleReject(selectedPayment.id)}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-2 border-2 border-red-100 text-red-500 font-bold rounded-2xl hover:bg-red-50 hover:border-red-200 transition-all active:scale-95 flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  ปฏิเสธ
                </button>
                <button
                  onClick={() => handleApprove(selectedPayment.id, selectedPayment.subscriptions.id, selectedPayment.subscriptions.end_date, selectedPayment.subscriptions.billing_cycle)}
                  disabled={isProcessing}
                  className="flex-[1.5] py-3 px-4 bg-[#CCF0D4] text-[#166534] font-bold rounded-2xl hover:bg-[#B5EAC0] transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-green-100 text-sm whitespace-nowrap border border-green-200/50"
                >
                  {isProcessing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  )}
                  อนุมัติ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}