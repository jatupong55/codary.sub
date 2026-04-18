// src/app/admin/customers/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

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
  master_account_id: string | null;
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionData | null>(null);

  const [editEndDate, setEditEndDate] = useState('');
  const [editHouseId, setEditHouseId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const openEditModal = (sub: SubscriptionData) => {
    setSelectedSub(sub);
    setEditEndDate(sub.end_date);
    setEditHouseId(sub.master_account_id || '');
    setIsModalOpen(true);
    setTimeout(() => setIsAnimating(true), 50);
  };

  const handleCloseModal = () => {
    setIsAnimating(false);
    setTimeout(() => setIsModalOpen(false), 300);
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
          id, end_date, status, master_account_id,
          users!subscriptions_user_id_fkey ( id, display_name, email ),
          products!subscriptions_product_id_fkey ( id, name, category ),
          master_accounts!subscriptions_master_account_id_fkey ( id, email ),
          payments ( id, status, slip_url, amount )
        `)
        .order('end_date', { ascending: true });

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
      console.error('Fetch error:', error);
      Swal.fire({
        icon: 'error',
        title: 'โหลดข้อมูลไม่สำเร็จ',
        text: error.message,
        confirmButtonColor: '#111827'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSub) return;
    setIsProcessing(true);

    try {
      // 1. อัปเดตข้อมูล Subscription ให้เป็น active และผูกบ้าน
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          end_date: editEndDate,
          master_account_id: editHouseId || null
        })
        .eq('id', selectedSub.id);

      if (subError) throw subError;

      // 2. ถ้ามี Payment ที่รอตรวจสอบ ให้อัปเดตเป็นสำเร็จ
      const pendingPayment = selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending');
      if (pendingPayment) {
        const { error: payError } = await supabase
          .from('payments')
          .update({ status: 'สำเร็จ' })
          .eq('id', pendingPayment.id);
        
        if (payError) throw payError;
      }

      handleCloseModal();

      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'อนุมัติและอัปเดตข้อมูลลูกค้าเรียบร้อยแล้ว',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

      await fetchData();
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: error.message,
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-4 border-gray-800 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const groupedUsers = Array.from(subscriptions.reduce((acc, sub) => {
    const email = sub.users?.email || 'unknown';
    if (!acc.has(email)) {
      acc.set(email, {
        userId: (sub.users as any)?.id || email, 
        displayName: sub.users?.display_name || 'ไม่ระบุชื่อ',
        email: email,
        subs: []
      });
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
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-yellow-100 text-yellow-800">
                            รออนุมัติ ({pendingCount})
                          </span>
                        ) : activeCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-[#CCF0D4] text-green-800">
                            กำลังใช้งาน ({activeCount})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-100 text-red-800">
                            หมดอายุทั้งหมด
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
                          className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors shadow-sm inline-flex items-center gap-1.5 ${
                            isExpanded ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {isExpanded ? 'ปิด' : 'ดูแพ็กเกจ'}
                          <svg className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                  <th className="pb-2 font-medium">บ้านที่ใช้งาน</th>
                                  <th className="pb-2 font-medium">วันหมดอายุ</th>
                                  <th className="pb-2 font-medium">สถานะ</th>
                                  <th className="pb-2 font-medium text-right">จัดการ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {user.subs.map((sub: any) => {
                                  const isExpired = new Date(sub.end_date) < new Date();
                                  const pendingPayment = sub.payments?.find((p: any) => p.status === 'รอตรวจสอบ' || p.status === 'pending');
                                  const needsAttention = sub.status === 'pending' || pendingPayment;

                                  return (
                                    <tr key={sub.id} className="border-b border-gray-100/50 last:border-0 hover:bg-white/60">
                                      <td className="py-3 text-sm text-gray-800 font-medium">
                                        {sub.products?.name || 'N/A'}
                                        {pendingPayment && (
                                          <span className="ml-2 inline-flex items-center text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">
                                            มีสลิปใหม่
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 text-sm">
                                        {sub.master_accounts ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[11px] shadow-sm">
                                            {sub.master_accounts.email}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-xs italic">ยังไม่จัดบ้าน</span>
                                        )}
                                      </td>
                                      <td className="py-3 text-sm">
                                        <span className={`whitespace-nowrap ${isExpired && sub.status !== 'pending' ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                                          {new Date(sub.end_date).toLocaleDateString('th-TH')}
                                        </span>
                                      </td>
                                      <td className="py-3 text-sm">
                                        <span className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${
                                          sub.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                          sub.status === 'active' && !isExpired ? 'bg-[#CCF0D4] text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {sub.status === 'pending' ? 'รออนุมัติ' : isExpired ? 'หมดอายุ' : sub.status}
                                        </span>
                                      </td>
                                      <td className="py-3 text-right">
                                        <button
                                          onClick={() => openEditModal(sub)}
                                          className={`px-2.5 py-1 border rounded-md text-xs font-medium transition-colors shadow-sm ${
                                            needsAttention ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                          }`}
                                        >
                                          {needsAttention ? 'ตรวจสอบ' : 'จัดการ'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
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
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    ยังไม่มีข้อมูลลูกค้าในระบบ
                  </td>
                </tr>
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
              
              <button 
                type="button"
                onClick={handleCloseModal} 
                className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">ลูกค้า / แพ็กเกจ</p>
                <p className="font-bold text-gray-800 text-sm mt-1">{selectedSub.users?.display_name} ({selectedSub.users?.email})</p>
                <p className="text-sm text-blue-600 font-medium">{selectedSub.products?.name}</p>
              </div>

              {/* ส่วนแสดงสลิปโอนเงิน (แสดงเฉพาะเมื่อมี Payment รอตรวจสอบ) */}
              {(() => {
                const pendingPayment = selectedSub.payments?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending');
                if (pendingPayment && pendingPayment.slip_url) {
                  return (
                    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                      <div className="bg-gray-100 py-2 px-3 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700">สลิปชำระเงิน (รอตรวจสอบ)</span>
                      </div>
                      <img src={pendingPayment.slip_url} alt="Slip" className="w-full h-auto max-h-60 object-contain bg-gray-50" />
                      <div className="p-2 bg-white text-center border-t border-gray-100">
                        <span className="text-sm font-bold text-green-600">ยอดเงิน: ฿{pendingPayment.amount}</span>
                      </div>
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
                  {masterAccounts
                    .filter(house => house.product_id === selectedSub.products?.id)
                    .map(house => (
                      <option key={house.id} value={house.id}>{house.email}</option>
                    ))
                  }
                </select>
                <p className="text-[11px] text-gray-500 mt-1.5">* เลือกอีเมลบ้าน (Family) เพื่อจัดสรรโควตาให้ลูกค้า</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">แก้ตรงวันหมดอายุ</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'กำลังบันทึก...' : selectedSub.status === 'pending' ? 'อนุมัติและบันทึก' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}