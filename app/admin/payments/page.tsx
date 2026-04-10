// src/app/admin/payments/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

interface Payment {
  id: string;
  amount: number;
  status: string;
  slip_url: string;
  method: string;
  created_at: string;
  users: { display_name: string; email: string };
  subscriptions: {
    id: string;
    end_date: string;
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
        id, amount, status, slip_url, method, created_at,
        users ( display_name, email ),
        subscriptions!payments_subscription_id_fkey ( 
          id, end_date, 
          products!subscriptions_product_id_fkey ( name, category, price ) 
        )
      `)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setPayments(data as any);
    }
    setIsLoading(false);
  };

  // ฟังก์ชันคำนวณวันหมดอายุใหม่ (บวกเพิ่ม 1 เดือน)
  const calculateNewEndDate = (currentEndDate: string) => {
    const date = new Date(currentEndDate);
    // กรณีที่หมดอายุไปแล้ว ให้เริ่มนับจากวันนี้
    if (date < new Date()) {
      const today = new Date();
      today.setMonth(today.getMonth() + 1);
      return today.toISOString();
    }
    // กรณีที่ยังไม่หมดอายุ ให้ทบไปอีก 1 เดือน
    date.setMonth(date.getMonth() + 1);
    return date.toISOString();
  };

  // ฟังก์ชันอนุมัติสลิป
  const handleApprove = async (paymentId: string, subId: string, currentEndDate: string) => {
    setIsProcessing(true);
    try {
      const newEndDate = calculateNewEndDate(currentEndDate);

      // 1. อัปเดตสถานะ payment และดักจับ Error
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'สำเร็จ' })
        .eq('id', paymentId);

      if (paymentError) throw paymentError;

      // 2. อัปเดตวันหมดอายุของ subscription และดักจับ Error
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({ end_date: newEndDate, status: 'active' })
        .eq('id', subId);

      if (subError) throw subError;

      handleCloseModal();
      
      // แจ้งเตือนสวยๆ ว่าสำเร็จแล้ว
      Swal.fire({
        icon: 'success',
        title: 'อนุมัติสำเร็จ!',
        text: 'ต่ออายุแพ็กเกจให้ลูกค้าเรียบร้อยแล้ว',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

      await fetchPayments(); // โหลดข้อมูลใหม่
    } catch (error: any) {
      console.error('Approval error:', error);
      Swal.fire({
        icon: 'error',
        title: 'อัปเดตไม่สำเร็จ',
        text: error.message || 'เกิดข้อผิดพลาดในการอนุมัติ',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ฟังก์ชันปฏิเสธสลิป
  const handleReject = async (paymentId: string) => {
    // 1. ถามยืนยันด้วย SweetAlert2 สวยๆ
    const confirmResult = await Swal.fire({
      title: 'ยืนยันการปฏิเสธ?',
      text: "คุณต้องการปฏิเสธและยกเลิกรายการนี้ใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444', // สีแดงสื่อถึงการยกเลิก/อันตราย
      cancelButtonColor: '#9ca3af',  // สีเทา
      confirmButtonText: 'ใช่, ปฏิเสธรายการ',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!confirmResult.isConfirmed) return; // ถ้ากดยกเลิกก็หยุดการทำงานตรงนี้

    setIsProcessing(true);
    try {
      // 2. อัปเดตฐานข้อมูลและดักจับ Error
      const { error } = await supabase
        .from('payments')
        .update({ status: 'ยกเลิก' })
        .eq('id', paymentId);

      if (error) throw error;

      handleCloseModal();

      // 3. แจ้งเตือนเมื่อทำรายการสำเร็จ
      Swal.fire({
        icon: 'success',
        title: 'ปฏิเสธรายการแล้ว',
        text: 'ปรับสถานะเป็น "ยกเลิก" เรียบร้อย',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

      await fetchPayments(); // โหลดข้อมูลมาแสดงใหม่
    } catch (error: any) {
      console.error('Rejection error:', error);
      Swal.fire({
        icon: 'error',
        title: 'ทำรายการไม่สำเร็จ',
        text: error.message || 'เกิดข้อผิดพลาดในการปฏิเสธสลิป',
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
      <div className="h-full flex items-center justify-center">
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
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
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
                <th className="px-6 py-4 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(payment.created_at).toLocaleString('th-TH')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{payment.users?.display_name || 'ไม่ระบุ'}</div>
                    <div className="text-xs text-gray-500">{payment.users?.email}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {payment.subscriptions?.products?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">
                    ฿{payment.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      payment.status === 'สำเร็จ' ? 'bg-[#CCF0D4] text-green-800' :
                      payment.status === 'รอตรวจสอบ' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
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

      {/* Slip Approval Modal (Glassmorphism) */}
      {isModalOpen && selectedPayment && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-white/90 backdrop-blur-xl border border-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col md:flex-row overflow-hidden">
            
            {/* Left: Slip Image */}
            <div className="md:w-1/2 bg-gray-100 p-4 flex items-center justify-center min-h-[300px]">
              {selectedPayment.slip_url ? (
                // ใช้ img ธรรมดาแทน Image ของ Next.js เพื่อความยืดหยุ่นในการแสดงภาพจาก External URL (Supabase Storage)
                <img 
                  src={selectedPayment.slip_url} 
                  alt="Payment Slip" 
                  className="max-h-[500px] w-auto object-contain rounded-lg shadow-sm"
                />
              ) : (
                <p className="text-gray-400">ไม่มีรูปสลิป</p>
              )}
            </div>

            {/* Right: Details & Actions */}
            <div className="md:w-1/2 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800">ตรวจสอบการชำระเงิน</h3>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">ลูกค้า</label>
                  <p className="text-gray-800 font-medium">{selectedPayment.users?.display_name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">แพ็กเกจที่ต้องการต่ออายุ</label>
                  <p className="text-gray-800 font-medium">{selectedPayment.subscriptions?.products?.name}</p>
                  <p className="text-xs text-gray-500">วันหมดอายุเดิม: {new Date(selectedPayment.subscriptions?.end_date).toLocaleDateString('th-TH')}</p>
                </div>
                <div className="p-3 bg-[#BCE2E8]/20 rounded-xl border border-[#BCE2E8]/50">
                  <label className="text-xs text-gray-500 uppercase font-semibold">ยอดเงินที่โอน</label>
                  <p className="text-2xl font-bold text-gray-800">฿{selectedPayment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {selectedPayment.status === 'รอตรวจสอบ' && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => handleReject(selectedPayment.id)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    ปฏิเสธรายการ
                  </button>
                  <button
                    onClick={() => handleApprove(selectedPayment.id, selectedPayment.subscriptions.id, selectedPayment.subscriptions.end_date)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? 'กำลังดำเนินการ...' : 'อนุมัติ'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}