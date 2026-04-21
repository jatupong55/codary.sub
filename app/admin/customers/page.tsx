// src/app/admin/customers/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { sendLineAdmin } from '@/lib/lineNotify';

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface PaymentData {
  id: string;
  status: string;
  slip_url: string;
  amount: number;
}

interface SubscriptionData {
  id: string;
  end_date: string;
  status: string;
  billing_cycle: string;
  master_account_id: string | null;
  details?: any;
  users: { display_name: string; email: string };
  products: { id: string; name: string; category: string };
  master_accounts?: { id: string; email: string };
  payments?: PaymentData[];
}

interface MasterAccount {
  id: string;
  product_id: string;
  email: string;
  max_slots: number;
}

export default function AdminCustomersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [masterAccounts, setMasterAccounts] = useState<MasterAccount[]>([]);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showCancelledFor, setShowCancelledFor] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionData | null>(null);

  const [editEndDate, setEditEndDate] = useState('');
  const [editHouseId, setEditHouseId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const openEditModal = (sub: SubscriptionData) => {
    setSelectedSub(sub);

    let defaultEndDate = sub.end_date ? sub.end_date.split('T')[0] : '';

    if (sub.status === 'pending') {
      // [UPDATE] ใช้คอลัมน์ billing_cycle ตรงๆ ได้เลย
      const isYearly = sub.billing_cycle === 'yearly';
      const daysToAdd = isYearly ? 365 : 30;

      let baseDate = new Date();
      if (sub.end_date) {
        const oldEndDate = new Date(sub.end_date);
        if (oldEndDate > new Date()) {
          baseDate = oldEndDate;
        }
      }

      baseDate.setDate(baseDate.getDate() + daysToAdd);
      defaultEndDate = format(baseDate, 'yyyy-MM-dd');
    }

    setEditEndDate(defaultEndDate);
    setEditHouseId(sub.master_account_id || '');
    setIsModalOpen(true);
    setTimeout(() => setIsAnimating(true), 50);
  };

  const handleCloseModal = () => {
    setIsAnimating(false);
    setTimeout(() => setIsModalOpen(false), 300);
  };

  const toggleCancelled = (userId: string) => {
    setShowCancelledFor(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          id, end_date, status, master_account_id, details, billing_cycle,
          users!subscriptions_user_id_fkey ( id, display_name, email ),
          products!subscriptions_product_id_fkey ( id, name, category ),
          master_accounts!subscriptions_master_account_id_fkey ( id, email ),
          payments ( id, status, slip_url, amount )
        `)
        .order('created_at', { ascending: false });

      if (subError) throw subError;

      const { data: houseData, error: houseError } = await supabase
        .from('master_accounts')
        .select('id, product_id, email, max_slots')
        .eq('status', 'active');

      if (houseError && houseError.code !== '42P01') {
        console.error('House Error:', houseError);
      }

      setSubscriptions((subData as any) || []);
      setMasterAccounts(houseData || []);

    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message, confirmButtonColor: '#111827' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSub) return;
    setIsProcessing(true);

    try {
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          end_date: editEndDate,
          master_account_id: editHouseId || null
        })
        .eq('id', selectedSub.id);

      if (subError) throw subError;

      const pendingPayment = selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending');
      if (pendingPayment) {
        const { error: payError } = await supabase
          .from('payments')
          .update({ status: 'สำเร็จ' })
          .eq('id', pendingPayment.id);

        if (payError) throw payError;
      }

      handleCloseModal();
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'อนุมัติและอัปเดตข้อมูลลูกค้าเรียบร้อยแล้ว', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
      await fetchData();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message, confirmButtonColor: '#ef4444' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSlip = async (paymentId: string) => {
    const { value: rejectReason } = await Swal.fire({
      title: 'ปฏิเสธสลิป?',
      html: '<p class="text-sm text-gray-500 mb-2">ระบุเหตุผลเพื่อให้ลูกค้าทราบและโอนเงินใหม่</p>',
      input: 'text',
      inputPlaceholder: 'เช่น ยอดเงินไม่ตรง, สลิปซ้ำ, รูปไม่ชัด...',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'ปฏิเสธสลิป',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl' },
      inputValidator: (value) => {
        if (!value) return 'กรุณาระบุเหตุผลด้วยครับ!';
      }
    });

    if (rejectReason) {
      setIsProcessing(true);
      try {
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'ถูกปฏิเสธ',
            note: rejectReason
          })
          .eq('id', paymentId);

        if (error) throw error;

        Swal.fire({ icon: 'success', title: 'ปฏิเสธสลิปแล้ว', text: 'ระบบได้แจ้งให้ลูกค้าทราบเพื่อโอนเงินใหม่แล้ว', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
        handleCloseModal();
        await fetchData();
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message, confirmButtonColor: '#ef4444' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCancelSubscription = async (sub: SubscriptionData) => {
    const { value: cancelForm } = await Swal.fire({
      title: 'ยกเลิกแพ็กเกจ',
      html: `
      <div class="text-left mt-4 space-y-4">
        <div>
          <p class="text-sm font-bold text-gray-700 mb-2">1. วิธีการยกเลิก</p>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name="cancelMode" value="immediate" checked class="w-4 h-4 text-red-600">
              <div>
                <p class="text-sm font-bold text-red-600">ยกเลิกทันที (บัด NOW)</p>
                <p class="text-xs text-gray-500">คืนโควตาทันที ยิงแจ้งเตือนแอดมินทันที</p>
              </div>
            </label>
            <label class="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name="cancelMode" value="end_of_period" class="w-4 h-4 text-orange-500">
              <div>
                <p class="text-sm font-bold text-orange-600">ตั้งเวลายกเลิกเมื่อหมดรอบบิล</p>
                <p class="text-xs text-gray-500">ใช้งานได้จนถึง ${new Date(sub.end_date).toLocaleDateString('th-TH')} จากนั้นระบบจะเตะอัตโนมัติ</p>
              </div>
            </label>
          </div>
        </div>
        <div>
          <p class="text-sm font-bold text-gray-700 mb-2">2. เหตุผลที่ยกเลิก</p>
          <textarea id="cancelReason" class="w-full border rounded-xl p-3 text-sm" placeholder="กรอกเหตุผลเพื่อเก็บเป็นประวัติ..." rows="3"></textarea>
        </div>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      confirmButtonColor: '#111827',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl' },
      preConfirm: () => {
        const mode = (document.querySelector('input[name="cancelMode"]:checked') as HTMLInputElement).value;
        const reason = (document.getElementById('cancelReason') as HTMLTextAreaElement).value;
        if (!reason) {
          Swal.showValidationMessage('กรุณากรอกเหตุผลด้วยครับ');
        }
        return { mode, reason };
      }
    });

    if (cancelForm) {
      const { mode, reason } = cancelForm;
      const currentDetails = sub.details || {};

      try {
        if (mode === 'immediate') {
          const updatedDetails = { ...currentDetails, cancelReason: reason, cancelMode: 'immediate', cancelledAt: new Date().toISOString() };
          const { error } = await supabase.from('subscriptions').update({ status: 'cancelled', master_account_id: null, details: updatedDetails }).eq('id', sub.id);
          if (error) throw error;

          const alertMessage = `🔴 [แจ้งเตือน] เตะลูกค้าออกจากระบบทันที!\n----------------------\n🛍️ แบรนด์: ${sub.products?.name}\n🏠 บ้าน: ${sub.master_accounts?.email || 'ยังไม่จัดบ้าน'}\n👤 ลูกค้า: ${sub.users?.email}\n📄 เหตุผล: ${reason}\n----------------------\n⚠️ แอดมินโปรดเข้าไปเตะอีเมลนี้ออกจาก Family ด่วน เพื่อคืนโควตา!`;
          await sendLineAdmin(alertMessage).catch(e => console.error(e));
          Swal.fire({ icon: 'success', title: 'ยกเลิกสำเร็จ!', text: 'ลูกค้ารายนี้ถูกเตะออกจากแพ็กเกจทันที', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
        } else if (mode === 'end_of_period') {
          const updatedDetails = { ...currentDetails, cancelAtPeriodEnd: true, cancelReason: reason, cancelMode: 'end_of_period', cancelledAt: new Date().toISOString() };
          const { error } = await supabase.from('subscriptions').update({ details: updatedDetails }).eq('id', sub.id);
          if (error) throw error;

          const alertMessage = `🟡 [แจ้งเตือน] ลูกค้าแจ้งขอยกเลิกเมื่อหมดรอบบิล\n----------------------\n🛍️ แบรนด์: ${sub.products?.name}\n🏠 บ้าน: ${sub.master_accounts?.email || 'ยังไม่จัดบ้าน'}\n👤 ลูกค้า: ${sub.users?.email}\n📅 ใช้งานได้ถึง: ${new Date(sub.end_date).toLocaleDateString('th-TH')}\n📄 เหตุผล: ${reason}`;
          await sendLineAdmin(alertMessage).catch(e => console.error(e));

          Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: `ระบบจะเตะลูกค้าออกอัตโนมัติเมื่อถึงวันที่ ${new Date(sub.end_date).toLocaleDateString('th-TH')}`, confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
        }
        await fetchData();
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message, confirmButtonColor: '#ef4444' });
      }
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center min-h-[400px]"><div className="animate-spin w-10 h-10 border-4 border-gray-800 border-t-transparent rounded-full"></div></div>;
  }

  const groupedUsers = Array.from(subscriptions.reduce((acc, sub) => {
    const email = sub.users?.email || 'unknown';
    if (!acc.has(email)) {
      acc.set(email, { userId: (sub.users as any)?.id || email, displayName: sub.users?.display_name || 'ไม่ระบุชื่อ', email: email, subs: [] });
    }
    acc.get(email).subs.push(sub);
    return acc;
  }, new Map()).values());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">จัดการลูกค้าและบ้าน</h1>
          <p className="text-gray-500 mt-2">ตรวจสอบสลิป จัดคนลงบ้าน และจัดการวันหมดอายุ</p>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-sm text-gray-500">
                <th className="px-6 py-4 font-medium">ลูกค้า</th>
                <th className="px-6 py-4 font-medium">จำนวนแพ็กเกจ</th>
                <th className="px-6 py-4 font-medium">สถานะรวม</th>
                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {groupedUsers.map((user: any) => {
                const isExpanded = expandedUserId === user.userId;
                const activeCount = user.subs.filter((s: any) => s.status === 'active' && new Date(s.end_date) >= new Date()).length;
                const pendingCount = user.subs.filter((s: any) => s.status === 'pending').length;
                const totalCount = user.subs.length;

                return (
                  <React.Fragment key={user.userId}>
                    <tr className={`border-b border-gray-100/50 transition-colors ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-white/40'}`}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">{user.displayName}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200">
                          {totalCount} รายการ
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {pendingCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-yellow-100 text-yellow-800">รออนุมัติ ({pendingCount})</span>
                        ) : activeCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-[#CCF0D4] text-green-800">กำลังใช้งาน ({activeCount})</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-100 text-red-800">หมดอายุทั้งหมด</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setExpandedUserId(isExpanded ? null : user.userId)} className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors shadow-sm inline-flex items-center gap-1.5 ${isExpanded ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                          {isExpanded ? 'ปิด' : 'ดูแพ็กเกจ'}
                          <svg className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="p-0 bg-gray-50/50 border-b border-gray-200 shadow-inner">
                          <div className="px-6 py-4 pl-12 border-l-4 border-[#BCE2E8]">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-xs text-gray-400 border-b border-gray-200/50">
                                  <th className="pb-2 font-medium">ชื่อแพ็กเกจ</th>
                                  <th className="pb-2 font-medium">รอบบิล</th>
                                  <th className="pb-2 font-medium">บ้านที่ใช้งาน</th>
                                  <th className="pb-2 font-medium">วันหมดอายุ</th>
                                  <th className="pb-2 font-medium">สถานะ</th>
                                  <th className="pb-2 font-medium text-right">จัดการ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* ✅ แยก cancelled ออก + เรียง created_at ล่าสุดขึ้นก่อน */}
                                {(() => {
                                  const isShowingCancelled = showCancelledFor.has(user.userId);

                                  const activeSubs = user.subs
                                    .filter((s: any) => s.status !== 'cancelled')
                                    .sort((a: any, b: any) =>
                                      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
                                    );

                                  const cancelledSubs = user.subs
                                    .filter((s: any) => s.status === 'cancelled')
                                    .sort((a: any, b: any) =>
                                      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
                                    );

                                  const visibleSubs = isShowingCancelled
                                    ? [...activeSubs, ...cancelledSubs]
                                    : activeSubs;

                                  return (
                                    <>
                                      {visibleSubs.map((sub: any) => {
                                        const isExpired = new Date(sub.end_date) < new Date();
                                        const pendingPayment = sub.payments?.find((p: any) => p.status === 'รอตรวจสอบ' || p.status === 'pending');
                                        const needsAttention = sub.status === 'pending' || pendingPayment;
                                        const isWaitingCancel = sub.details?.cancelAtPeriodEnd === true;

                                        return (
                                          <tr key={sub.id} className="border-b border-gray-100/50 last:border-0 hover:bg-white/60">
                                            <td className="py-3 text-sm text-gray-800 font-medium">
                                              {sub.products?.name || 'N/A'}
                                              {pendingPayment && (
                                                <span className="ml-2 inline-flex items-center text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">มีสลิปใหม่</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-sm">
                                              {sub.billing_cycle === 'yearly' ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">รายปี</span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">รายเดือน</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-sm">
                                              {sub.master_accounts ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[11px] shadow-sm">{sub.master_accounts.email}</span>
                                              ) : (
                                                <span className="text-gray-400 text-xs italic">ยังไม่จัดบ้าน</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-sm">
                                              <span className={`whitespace-nowrap ${isExpired && sub.status !== 'pending' ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                                                {new Date(sub.end_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                              </span>
                                            </td>
                                            <td className="py-3 text-sm flex gap-1 items-center">
                                              <span className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${sub.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                  sub.status === 'cancelled' ? 'bg-gray-200 text-gray-600' :
                                                    sub.status === 'active' && !isExpired ? 'bg-[#CCF0D4] text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {sub.status === 'pending' ? 'รออนุมัติ' : sub.status === 'cancelled' ? 'ยกเลิกแล้ว' : isExpired ? 'หมดอายุ' : sub.status}
                                              </span>
                                              {isWaitingCancel && sub.status === 'active' && !isExpired && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 whitespace-nowrap">รอเตะออก</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-right">
                                              {sub.status !== 'cancelled' && (
                                                <div className="flex justify-end gap-2">
                                                  <button onClick={() => openEditModal(sub)} className={`px-2.5 py-1 border rounded-md text-xs font-medium transition-colors shadow-sm ${needsAttention ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                                    {needsAttention ? 'ตรวจสอบ' : 'จัดการ'}
                                                  </button>
                                                  <button onClick={() => handleCancelSubscription(sub)} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 hover:shadow-sm transition-all">
                                                    ยกเลิก/เตะออก
                                                  </button>
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* ✅ ปุ่มโชว์/ซ่อน cancelled */}
                                      {cancelledSubs.length > 0 && (
                                        <tr>
                                          <td colSpan={6} className="pt-2 pb-1">
                                            <button
                                              onClick={() => toggleCancelled(user.userId)}
                                              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                              <svg className={`w-3.5 h-3.5 transform transition-transform ${isShowingCancelled ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                              {isShowingCancelled
                                                ? `ซ่อนรายการที่ยกเลิกแล้ว (${cancelledSubs.length})`
                                                : `แสดงรายการที่ยกเลิกแล้ว (${cancelledSubs.length})`
                                              }
                                            </button>
                                          </td>
                                        </tr>
                                      )}
                                    </>
                                  );
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {groupedUsers.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">ยังไม่มีข้อมูลลูกค้าในระบบ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedSub && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
            <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#BCE2E8]/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

              <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {selectedSub.status === 'pending' ? 'อนุมัติแพ็กเกจ' : 'จัดการข้อมูลลูกค้า'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* ส่วนแสดงรายละเอียดแพ็กเกจ (รายเดือน/รายปี และราคา) */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-2">
                <p className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wider">ข้อมูลลูกค้า & แพ็กเกจที่เลือก</p>
                <div className="mb-2">
                  <p className="font-bold text-gray-800 text-sm">{selectedSub.users?.display_name}</p>
                  <p className="text-xs text-gray-500">{selectedSub.users?.email}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200 border-dashed">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-blue-600">{selectedSub.products?.name}</p>
                    {/* เช็กและแสดง Badge รายปี/รายเดือน */}
                    {selectedSub.billing_cycle === 'yearly' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">รายปี</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">รายเดือน</span>
                    )}
                  </div>
                  {selectedSub.details?.expectedPrice && (
                    <p className="text-sm font-black text-green-600">
                      ฿{Number(selectedSub.details.expectedPrice).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>

              {/* ส่วนแสดงสลิปโอนเงิน และปุ่มปฏิเสธ */}
              {(() => {
                const pendingPayment = selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending');
                if (pendingPayment && pendingPayment.slip_url) {
                  return (
                    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                      <div className="bg-gray-100 py-2 px-3 border-b border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-700">สลิปชำระเงิน (รอตรวจสอบ)</span>
                      </div>
                      <img src={pendingPayment.slip_url} alt="Slip" className="w-full h-auto max-h-60 object-contain bg-gray-50" />
                      <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-green-600">ยอดเงิน: ฿{pendingPayment.amount}</span>
                        <button
                          onClick={() => handleRejectSlip(pendingPayment.id)}
                          className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 transition-colors"
                        >
                          ปฏิเสธสลิปนี้
                        </button>
                      </div>
                    </div>
                  );
                } else if (selectedSub.status === 'pending') {
                  return (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl mb-4">
                      <p className="text-xs text-orange-600 font-bold flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        ลูกค้ารายนี้ยังไม่ได้แนบสลิปชำระเงิน
                      </p>
                      <p className="text-[11px] text-orange-500 mt-1">กรุณารอให้ลูกค้าอัปโหลดสลิปก่อนจึงจะสามารถอนุมัติได้</p>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">จัดคนลงบ้าน (Master Account)</label>
                <select
                  value={editHouseId}
                  onChange={(e) => setEditHouseId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800 outline-none transition-colors"
                >
                  <option value="">-- ไม่ระบุ (เว้นว่าง) --</option>
                  {masterAccounts.filter(house => house.product_id === selectedSub.products?.id).map(house => (
                    <option key={house.id} value={house.id}>{house.email}</option>
                  ))}
                </select>
              </div>

              <div className="relative z-[100]">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between">
                  <span>วันหมดอายุ</span>
                  {selectedSub.status === 'pending' && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded font-bold">บวกวันให้อัตโนมัติแล้ว ✨</span>
                  )}
                </label>
                <DatePicker
                  selected={editEndDate ? new Date(editEndDate) : null}
                  onChange={(date: Date | null) => {
                    setEditEndDate(date ? format(date, 'yyyy-MM-dd') : '');
                  }}
                  dateFormat="dd/MM/yyyy"
                  locale={th}
                  placeholderText="วัน/เดือน/ปี"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                  wrapperClassName="w-full"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={handleCloseModal} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">ยกเลิก</button>

                {selectedSub.status === 'pending' && !selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending') ? (
                  <button disabled className="flex-1 py-2.5 bg-gray-200 text-gray-400 font-medium rounded-xl cursor-not-allowed">
                    รอลูกค้าแนบสลิป
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={isProcessing} className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
                    {isProcessing ? 'กำลังบันทึก...' : selectedSub.status === 'pending' ? 'อนุมัติและบันทึก' : 'บันทึกข้อมูล'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}