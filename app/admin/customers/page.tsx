// src/app/admin/customers/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { sendLineAdmin, sendLineUser } from '@/lib/lineNotify';
import { sendWebPushToUser } from '@/lib/webPush';

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";

import { isSubExpired, formatDate, calculateDaysLeft } from '@/utils/subscriptionUtils';
import type {
  AdminSubscription,
  AdminMasterAccount,
  GroupedAdminUser as GroupedUser
} from '@/types/admin';

export default function AdminCustomersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [masterAccounts, setMasterAccounts] = useState<AdminMasterAccount[]>([]);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showCancelledFor, setShowCancelledFor] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedSub, setSelectedSub] = useState<AdminSubscription | null>(null);

  const [editEndDate, setEditEndDate] = useState('');
  const [editHouseId, setEditHouseId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const openEditModal = (sub: AdminSubscription) => {
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
          users ( id, display_name, email, line_user_id ),
          products ( id, name, category ),
          master_accounts ( id, email ),
          payments ( id, status, slip_url, amount )
        `)
        .order('created_at', { ascending: false });

      if (subError) throw subError;

      const { data: houseData, error: houseError } = await supabase
        .from('master_accounts')
        .select('id, product_id, email, max_slots, cost, billing_cycle, status')
        .eq('status', 'active');

      if (houseError && houseError.code !== '42P01') {
        console.error('House Error:', houseError);
      }

      setSubscriptions((subData as unknown as AdminSubscription[]) || []);
      setMasterAccounts(houseData || []);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: message, confirmButtonColor: '#111827' });
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

        // [NEW] แจ้งเตือนลูกค้าผ่าน LINE เมื่อสลิปถูกอนุมัติจากหน้านี้
        const user = Array.isArray(selectedSub.users) ? selectedSub.users[0] : (selectedSub.users as any);
        const product = Array.isArray(selectedSub.products) ? selectedSub.products[0] : (selectedSub.products as any);

        if (user?.line_user_id) {
          const formattedDate = new Date(editEndDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
          const productName = product?.name || 'แพ็กเกจของคุณ';
          const lineMessage = `✅ ยืนยันการชำระเงินสำเร็จ\n\nระบบได้ดำเนินการอนุมัติและต่ออายุแพ็กเกจให้ท่านเรียบร้อยแล้วค่ะ\n\n📦 บริการ: ${productName}\n💳 ยอดเงิน: ${pendingPayment.amount} บาท\n📅 วันหมดอายุใหม่: ${formattedDate}\n\nหากมีข้อสงสัยเพิ่มเติม สามารถสอบถามแอดมินได้ตลอดนะคะ\n🙏 ขอบคุณที่ไว้วางใจ Codary Sub ค่ะ`;
          await sendLineUser(user.line_user_id, lineMessage).catch(e => console.error(e));
        }

        if (user?.id) {
          await sendWebPushToUser(user.id, {
            title: 'ชำระเงินสำเร็จ! 🎉',
            body: `แอดมินอนุมัติสลิปและต่ออายุแพ็กเกจให้คุณเรียบร้อยแล้ว`
          });
        }
      }

      handleCloseModal();
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'อนุมัติและอัปเดตข้อมูลลูกค้าเรียบร้อยแล้ว', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: message, confirmButtonColor: '#ef4444' });
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
      confirmButtonText: 'ปฏิเสธสลิป',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: 'rounded-[2rem] border border-gray-100 shadow-2xl',
        confirmButton: 'py-3 px-6 bg-red-50 text-red-500 font-bold rounded-2xl hover:bg-red-100 transition-all active:scale-95 text-sm mx-2',
        cancelButton: 'py-3 px-6 bg-gray-50 border-2 border-gray-300 text-gray-700 font-bold rounded-2xl hover:bg-gray-100 transition-all active:scale-95 text-sm mx-2'
      },
      buttonsStyling: false,
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

        // [NEW] แจ้งเตือนลูกค้าผ่าน LINE เมื่อสลิปถูกปฏิเสธจากหน้านี้
        const user = Array.isArray(selectedSub?.users) ? selectedSub?.users[0] : (selectedSub?.users as any);
        const product = Array.isArray(selectedSub?.products) ? selectedSub?.products[0] : (selectedSub?.products as any);
        const pendingPayment = selectedSub?.payments?.find(p => p.id === paymentId);

        if (user?.line_user_id && pendingPayment) {
          const productName = product?.name || 'แพ็กเกจของคุณ';
          const lineMessage = `❌ การชำระเงินไม่ผ่านการตรวจสอบ\n\nระบบไม่สามารถตรวจสอบยอดโอนของท่านได้ หรือพบความผิดปกติในสลิปที่แนบมาค่ะ\n\n📦 บริการ: ${productName}\n💳 ยอดเงินที่แจ้ง: ${pendingPayment.amount} บาท\n📝 เหตุผลจากแอดมิน: ${rejectReason}\n\nรบกวนตรวจสอบสลิปอีกครั้ง และทำรายการแจ้งโอนใหม่ผ่านหน้าเว็บไซต์ หรือติดต่อแอดมินเพื่อขอความช่วยเหลือนะคะ\n🙏 ขออภัยในความไม่สะดวกค่ะ`;
          await sendLineUser(user.line_user_id, lineMessage).catch(e => console.error(e));
        }

        if (user?.id) {
          await sendWebPushToUser(user.id, {
            title: 'สลิปไม่ผ่านการตรวจสอบ ❌',
            body: `เหตุผล: ${rejectReason}`
          });
        }

        Swal.fire({ icon: 'success', title: 'ปฏิเสธสลิปแล้ว', text: 'ระบบได้แจ้งให้ลูกค้าทราบเพื่อโอนเงินใหม่แล้ว', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
        handleCloseModal();
        await fetchData();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: message, confirmButtonColor: '#ef4444' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCancelSubscription = async (sub: AdminSubscription) => {
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
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: 'rounded-[2rem] border border-gray-100 shadow-2xl',
        confirmButton: 'py-3 px-8 bg-[#CCF0D4] text-[#166534] font-bold rounded-2xl hover:bg-[#B5EAC0] transition-all active:scale-95 text-sm mx-2 shadow-sm border border-green-200/50',
        cancelButton: 'py-3 px-8 bg-gray-50 border-2 border-gray-300 text-gray-700 font-bold rounded-2xl hover:bg-gray-100 transition-all active:scale-95 text-sm mx-2'
      },
      buttonsStyling: false,
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
        const prodName = Array.isArray(sub.products) ? sub.products[0]?.name : (sub.products as any)?.name;
        const houseEmail = Array.isArray(sub.master_accounts) ? sub.master_accounts[0]?.email : (sub.master_accounts as any)?.email;
        const userEmail = Array.isArray(sub.users) ? sub.users[0]?.email : (sub.users as any)?.email;

        if (mode === 'immediate') {
          const updatedDetails = { ...currentDetails, cancelReason: reason, cancelMode: 'immediate', cancelledAt: new Date().toISOString() };
          const { error } = await supabase.from('subscriptions').update({ status: 'cancelled', master_account_id: null, details: updatedDetails }).eq('id', sub.id);
          if (error) throw error;

          const alertMessage = `🔴 [แจ้งเตือน] เตะลูกค้าออกจากระบบทันที!\n----------------------\n🛍️ แบรนด์: ${prodName}\n🏠 บ้าน: ${houseEmail || 'ยังไม่จัดบ้าน'}\n👤 ลูกค้า: ${userEmail}\n📄 เหตุผล: ${reason}\n----------------------\n⚠️ แอดมินโปรดเข้าไปเตะอีเมลนี้ออกจาก Family ด่วน เพื่อคืนโควตา!`;
          await sendLineAdmin(alertMessage).catch(e => console.error(e));
          Swal.fire({ icon: 'success', title: 'ยกเลิกสำเร็จ!', text: 'ลูกค้ารายนี้ถูกเตะออกจากแพ็กเกจทันที', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
        } else if (mode === 'end_of_period') {
          const updatedDetails = { ...currentDetails, cancelAtPeriodEnd: true, cancelReason: reason, cancelMode: 'end_of_period', cancelledAt: new Date().toISOString() };
          const { error } = await supabase.from('subscriptions').update({ details: updatedDetails }).eq('id', sub.id);
          if (error) throw error;

          const alertMessage = `🟡 [แจ้งเตือน] ลูกค้าแจ้งขอยกเลิกเมื่อหมดรอบบิล\n----------------------\n🛍️ แบรนด์: ${prodName}\n🏠 บ้าน: ${houseEmail || 'ยังไม่จัดบ้าน'}\n👤 ลูกค้า: ${userEmail}\n📅 ใช้งานได้ถึง: ${new Date(sub.end_date).toLocaleDateString('th-TH')}\n📄 เหตุผล: ${reason}`;
          await sendLineAdmin(alertMessage).catch(e => console.error(e));

          Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: `ระบบจะเตะลูกค้าออกอัตโนมัติเมื่อถึงวันที่ ${new Date(sub.end_date).toLocaleDateString('th-TH')}`, confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
        }
        await fetchData();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: message, confirmButtonColor: '#ef4444' });
      }
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center min-h-[400px]"><div className="animate-spin w-10 h-10 border-4 border-gray-800 border-t-transparent rounded-full"></div></div>;
  }

  const groupedUsers = Array.from(subscriptions.reduce((acc, sub) => {
    const user = sub.users as { id: string; display_name: string; email: string } | { id: string; display_name: string; email: string }[] | null;
    const actualUser = Array.isArray(user) ? user[0] : user;
    const email = actualUser?.email || 'unknown';

    if (!acc.has(email)) {
      acc.set(email, {
        userId: actualUser?.id || email,
        displayName: actualUser?.display_name || 'ไม่ระบุชื่อ',
        email: email,
        subs: []
      });
    }
    const existingGroup = acc.get(email);
    if (existingGroup) {
      existingGroup.subs.push(sub);
    }
    return acc;
  }, new Map<string, GroupedUser>()).values());

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
                <th className="px-6 py-4 font-medium whitespace-nowrap">จำนวนแพ็กเกจ</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">สถานะรวม</th>
                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {groupedUsers.map((user: GroupedUser) => {
                const isExpanded = expandedUserId === user.userId;
                const activeCount = user.subs.filter((s) => s.status === 'active' && calculateDaysLeft(s.end_date) >= 0).length;
                const pendingCount = user.subs.filter((s) => s.status === 'pending').length;
                const totalCount = user.subs.length;

                return (
                  <React.Fragment key={user.userId}>
                    <tr className={`border-b border-gray-100/50 transition-colors ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-white/40'}`}>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-800 leading-tight">{user.displayName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 font-normal">{user.email}</div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200">
                          {totalCount} รายการ
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {pendingCount > 0 ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-yellow-600 bg-yellow-50 px-2 py-1 rounded shadow-[inset_0_0_0_1px_rgba(202,138,4,0.1)]">รออนุมัติ ({pendingCount})</span>
                        ) : activeCount > 0 ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-green-700 bg-[#CCF0D4] px-2 py-1 rounded shadow-[inset_0_0_0_1px_rgba(22,101,52,0.1)]">กำลังใช้งาน ({activeCount})</span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-1 rounded shadow-[inset_0_0_0_1px_rgba(220,38,38,0.1)]">หมดอายุทั้งหมด</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
                          className={`p-2 rounded-xl border transition-all shadow-sm active:scale-95 ${isExpanded ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-blue-600 hover:bg-blue-50'}`}
                          title={isExpanded ? 'ปิด' : 'ดูแพ็กเกจ'}
                        >
                          <svg className={`w-5 h-5 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
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
                                    .filter((s) => s.status !== 'cancelled')
                                    .sort((a, b) =>
                                      new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
                                    );

                                  const cancelledSubs = user.subs
                                    .filter((s) => s.status === 'cancelled')
                                    .sort((a, b) =>
                                      new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
                                    );

                                  const visibleSubs = isShowingCancelled
                                    ? [...activeSubs, ...cancelledSubs]
                                    : activeSubs;

                                  return (
                                    <>
                                      {visibleSubs.map((sub) => {
                                        const isExpired = isSubExpired(sub);
                                        const pendingPayment = sub.payments?.find((p) => p.status === 'รอตรวจสอบ' || p.status === 'pending');
                                        const needsAttention = sub.status === 'pending' || pendingPayment;
                                        const isWaitingCancel = sub.details?.cancelAtPeriodEnd === true;

                                        return (
                                          <tr key={sub.id} className="border-b border-gray-100/50 last:border-0 hover:bg-white/60">
                                            <td className="py-3 text-sm text-gray-800 font-medium">
                                              {Array.isArray(sub.products) ? sub.products[0]?.name : (sub.products as any)?.name || 'N/A'}
                                              {pendingPayment && (
                                                <span className="ml-2 inline-flex items-center text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">มีสลิปใหม่</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-sm">
                                              {sub.billing_cycle === 'yearly' ? (
                                                <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shadow-[inset_0_0_0_1px_rgba(147,51,234,0.1)]">รายปี</span>
                                              ) : (
                                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shadow-[inset_0_0_0_1px_rgba(37,99,235,0.1)]">รายเดือน</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-sm">
                                              {sub.master_accounts ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[11px] shadow-sm">
                                                  {Array.isArray(sub.master_accounts) ? sub.master_accounts[0]?.email : (sub.master_accounts as any)?.email}
                                                </span>
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
                                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] ${sub.status === 'pending' ? 'bg-yellow-50 text-yellow-600 shadow-[inset_0_0_0_1px_rgba(202,138,4,0.1)]' :
                                                sub.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                                                  sub.status === 'active' && !isExpired ? 'bg-[#CCF0D4] text-green-700 shadow-[inset_0_0_0_1px_rgba(22,101,52,0.1)]' : 'bg-red-50 text-red-600 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.1)]'
                                                }`}>
                                                {sub.status === 'pending' ? 'รออนุมัติ' : sub.status === 'cancelled' ? 'ยกเลิกแล้ว' : isExpired ? 'หมดอายุ' : 'ปกติ'}
                                              </span>
                                              {isWaitingCancel && sub.status === 'active' && !isExpired && (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 px-1.5 py-1 rounded shadow-[inset_0_0_0_1px_rgba(234,88,12,0.1)]">รอเตะออก</span>
                                              )}
                                            </td>
                                            <td className="py-3 text-right">
                                              {sub.status !== 'cancelled' && (
                                                <div className="flex justify-end gap-2">
                                                  <button
                                                    onClick={() => openEditModal(sub)}
                                                    className={`p-1.5 border rounded-lg transition-all shadow-sm active:scale-95 group ${needsAttention ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-gray-200 text-blue-600 hover:bg-blue-50'}`}
                                                    title={needsAttention ? 'ตรวจสอบสลิป/อนุมัติ' : 'จัดการข้อมูล'}
                                                  >
                                                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                  </button>
                                                  <button
                                                    onClick={() => handleCancelSubscription(sub)}
                                                    className="p-1.5 bg-white border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-all active:scale-95 group"
                                                    title="ยกเลิก/เตะออก"
                                                  >
                                                    <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
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
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-white border border-gray-100 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col transform transition-all duration-300 overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-bold text-gray-800">{selectedSub.status === 'pending' ? 'อนุมัติแพ็กเกจ' : 'จัดการข้อมูลลูกค้า'}</h3>
              </div>
              <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col md:flex-row min-h-full">

                {/* Left Side: Slip (If any) or Customer Summary */}
                <div className="w-full md:w-1/2 bg-gray-100/40 p-4 md:p-6 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-gray-100">
                  {(() => {
                    const pendingPayment = selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending');
                    if (pendingPayment && pendingPayment.slip_url) {
                      return (
                        <div className="flex flex-col gap-4">
                          <div className="relative group w-full flex justify-center">
                            <img
                              src={pendingPayment.slip_url}
                              alt="Payment Slip"
                              className="max-h-[40vh] md:max-h-[450px] w-auto object-contain rounded-xl shadow-md border-2 border-white"
                            />
                            <a href={pendingPayment.slip_url} target="_blank" className="absolute bottom-2 right-2 p-2 bg-black/40 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          </div>
                          <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider text-green-600/70 mb-0.5">ยอดเงินที่แจ้ง</p>
                              <p className="text-xl font-black text-green-600 tracking-tighter">฿{pendingPayment.amount}</p>
                            </div>
                            <button onClick={() => handleRejectSlip(pendingPayment.id)} className="px-3 py-1.5 bg-white border border-red-100 text-red-500 rounded-lg text-[11px] font-bold hover:bg-red-50 transition-all active:scale-95">ปฏิเสธสลิป</button>
                          </div>
                        </div>
                      );
                    } else {
                      const user = Array.isArray(selectedSub.users) ? selectedSub.users[0] : (selectedSub.users as any);
                      const product = Array.isArray(selectedSub.products) ? selectedSub.products[0] : (selectedSub.products as any);
                      return (
                        <div className="space-y-4">
                          <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">สรุปแพ็กเกจ</p>
                            <div className="flex items-start gap-3 mb-4 pb-4 border-b border-dashed border-gray-100">
                              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-800 truncate">{user?.display_name || 'N/A'}</h4>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-blue-600">{product?.name || 'N/A'}</h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{selectedSub.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}</p>
                              </div>
                              {selectedSub.details?.expectedPrice && (
                                <p className="text-lg font-black text-gray-800 tracking-tighter">฿{Number(selectedSub.details.expectedPrice).toLocaleString()}</p>
                              )}
                            </div>
                          </div>
                          {selectedSub.status === 'pending' && (
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0"><svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                              <p className="text-xs text-orange-700 font-medium leading-snug">ลูกค้ารายนี้ยังไม่ได้แนบสลิปชำระเงิน กรุณาตรวจสอบก่อนอนุมัติ</p>
                            </div>
                          )}
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Right Side: Inputs */}
                <div className="w-full md:w-1/2 p-6 flex flex-col gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">จัดคนลงบ้าน (Master Account)</label>
                      <select
                        value={editHouseId}
                        onChange={(e) => setEditHouseId(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="">-- ไม่ระบุ (เว้นว่าง) --</option>
                        {(() => {
                          const product = Array.isArray(selectedSub.products) ? selectedSub.products[0] : (selectedSub.products as any);
                          return masterAccounts.filter(house => house.product_id === product?.id).map(house => (
                            <option key={house.id} value={house.id}>{house.email}</option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex justify-between">
                        <span>วันหมดอายุ</span>
                        {selectedSub.status === 'pending' && <span className="text-green-600 font-bold tracking-normal">+30/365 วันให้แล้ว</span>}
                      </label>
                      <DatePicker
                        selected={editEndDate ? new Date(editEndDate) : null}
                        onChange={(date: Date | null) => setEditEndDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        dateFormat="dd/MM/yyyy"
                        locale={th}
                        placeholderText="วัน/เดือน/ปี"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        wrapperClassName="w-full"
                      />
                    </div>
                  </div>

                  <div className="mt-auto pt-6 flex gap-3">
                    <button onClick={handleCloseModal} className="flex-1 py-3 px-4 bg-gray-50 border-2 border-gray-300 text-gray-700 font-bold rounded-2xl hover:bg-gray-100 hover:border-gray-400 transition-all active:scale-95 text-sm">ยกเลิก</button>
                    <button
                      onClick={handleSave}
                      disabled={isProcessing || (selectedSub.status === 'pending' && !selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending'))}
                      className={`flex-[1.5] py-3 px-4 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shadow-lg ${selectedSub.status === 'pending' && !selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending')
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-[#CCF0D4] text-[#166534] hover:bg-[#B5EAC0] shadow-green-100 border border-green-200/50'
                        }`}
                    >
                      {isProcessing ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      )}
                      {selectedSub.status === 'pending' ? 'อนุมัติ' : 'บันทึกข้อมูล'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}