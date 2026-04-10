// src/app/admin/customers/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

// กำหนด Type ให้ข้อมูลที่ดึงมา
interface SubscriptionData {
  id: string;
  end_date: string;
  status: string;
  master_account_id: string | null;
  users: { display_name: string; email: string };
  products: { id: string; name: string; category: string };
  master_accounts?: { id: string; email: string }; // บ้านที่ลูกค้าอยู่
}

interface MasterAccount {
  id: string;
  product_id: string;
  email: string;
  max_slots: number;
}

export default function AdminCustomersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [masterAccounts, setMasterAccounts] = useState<MasterAccount[]>([]);
  
  // เพิ่ม State สำหรับจำว่ากำลังกดดูแพ็กเกจของใครอยู่
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // State สำหรับ Modal จัดการลูกค้า
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionData | null>(null);

  // State สำหรับฟอร์มใน Modal
  const [editEndDate, setEditEndDate] = useState('');
  const [editHouseId, setEditHouseId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 2. แก้ไขฟังก์ชันเปิด ให้มีแอนิเมชัน
  const openEditModal = (sub: SubscriptionData) => {
    setSelectedSub(sub);
    setEditEndDate(sub.end_date);
    setEditHouseId(sub.master_account_id || '');
    setIsModalOpen(true);
    setTimeout(() => setIsAnimating(true), 50); // หน่วงเวลาให้เด้งขึ้นมา
  };

  // 3. เพิ่มฟังก์ชันปิด Modal แบบนุ่มนิ่ม
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
      // 1. ดึงข้อมูลรายการแพ็กเกจของลูกค้าทั้งหมด (ใช้ Explicit Join ป้องกันบั๊ก)
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          id, end_date, status, master_account_id,
          users!subscriptions_user_id_fkey ( id, display_name, email ),
          products!subscriptions_product_id_fkey ( id, name, category ),
          master_accounts!subscriptions_master_account_id_fkey ( id, email )
        `)
        .order('end_date', { ascending: true });

      if (subError) throw subError;

      // 2. ดึงข้อมูล "บ้าน" ทั้งหมด เพื่อเอามาทำ Dropdown ให้แอดมินเลือกจัดคนลงบ้าน
      const { data: houseData, error: houseError } = await supabase
        .from('master_accounts')
        .select('id, product_id, email, max_slots')
        .eq('status', 'active');

      if (houseError && houseError.code !== '42P01') { 
        // ข้าม Error 42P01 (ตารางไม่มี) เผื่อบอสยังไม่ได้รัน SQL สร้างตาราง
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

  // บันทึกการแก้ไขข้อมูล
  const handleSave = async () => {
    if (!selectedSub) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          end_date: editEndDate,
          master_account_id: editHouseId || null // ถ้าไม่ได้เลือกบ้าน ให้เป็น null
        })
        .eq('id', selectedSub.id);

      if (error) throw error;

      handleCloseModal();

      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'อัปเดตข้อมูลลูกค้าเรียบร้อยแล้ว',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

      await fetchData(); // โหลดข้อมูลใหม่
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

  // Logic นำ Subscriptions ทั้งหมดมามัดรวมกันตาม Email ของลูกค้า
  const groupedUsers = Array.from(subscriptions.reduce((acc, sub) => {
    const email = sub.users?.email || 'unknown';
    // ถ้ายังไม่มีอีเมลนี้ในตะกร้า ให้สร้างตะกร้าใหม่
    if (!acc.has(email)) {
      acc.set(email, {
        userId: sub.users?.id || email,
        displayName: sub.users?.display_name || 'ไม่ระบุชื่อ',
        email: email,
        subs: [] // เตรียมกล่องเปล่าไว้ใส่แพ็กเกจ
      });
    }
    // เอาแพ็กเกจโยนใส่ตะกร้าของคนนั้นๆ
    acc.get(email).subs.push(sub);
    return acc;
  }, new Map()).values());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">จัดการลูกค้าและบ้าน</h1>
          <p className="text-gray-500 mt-2">ตรวจสอบวันหมดอายุ จัดคนลงบ้าน (Inventory) และต่ออายุด้วยมือ</p>
        </div>
      </div>

      {/* Table */}
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
                // นับว่าลูกค้าคนนี้มีกี่แพ็กเกจที่ยังไม่หมดอายุ
                const activeCount = user.subs.filter((s: any) => s.status === 'active' && new Date(s.end_date) >= new Date()).length;
                const totalCount = user.subs.length;

                return (
                  <React.Fragment key={user.userId}>
                    {/* 🟢 แถวหลัก: โชว์ข้อมูลสรุปของลูกค้า 1 คน */}
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
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          activeCount > 0 ? 'bg-[#CCF0D4] text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {activeCount > 0 ? `กำลังใช้งาน (${activeCount})` : 'หมดอายุทั้งหมด'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* ปุ่มเปิด/ปิด แถวย่อย */}
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

                    {/* 🟢 แถวย่อย: โชว์รายการแพ็กเกจของลูกค้าคนนั้น (จะแสดงก็ต่อเมื่อกดปุ่มดูแพ็กเกจ) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="p-0 bg-gray-50/50 border-b border-gray-200 shadow-inner">
                          <div className="px-6 py-4 pl-12 border-l-4 border-[#BCE2E8]">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-xs text-gray-400 border-b border-gray-200/50">
                                  <th className="pb-2 font-medium">ชื่อแพ็กเกจ</th>
                                  <th className="pb-2 font-medium">บ้านที่ใช้งาน (Inventory)</th>
                                  <th className="pb-2 font-medium">วันหมดอายุ</th>
                                  <th className="pb-2 font-medium">สถานะ</th>
                                  <th className="pb-2 font-medium text-right">จัดการ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {user.subs.map((sub: any) => {
                                  const isExpired = new Date(sub.end_date) < new Date();
                                  return (
                                    <tr key={sub.id} className="border-b border-gray-100/50 last:border-0 hover:bg-white/60">
                                      <td className="py-3 text-sm text-gray-800 font-medium">{sub.products?.name || 'N/A'}</td>
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
                                        {/* ✨ ล็อก whitespace-nowrap ป้องกันวันตกบรรทัด */}
                                        <span className={`whitespace-nowrap ${isExpired ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                                          {new Date(sub.end_date).toLocaleDateString('th-TH')}
                                        </span>
                                      </td>
                                      <td className="py-3 text-sm">
                                        {/* ✨ ล็อก whitespace-nowrap ป้องกันสถานะตกบรรทัด */}
                                        <span className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${
                                          sub.status === 'active' && !isExpired ? 'bg-[#CCF0D4] text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {isExpired ? 'หมดอายุ' : sub.status}
                                        </span>
                                      </td>
                                      <td className="py-3 text-right">
                                        <button
                                          onClick={() => openEditModal(sub)}
                                          className="px-2.5 py-1 bg-white border border-blue-200 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-50 transition-colors shadow-sm"
                                        >
                                          จัดการ
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

      {/* Edit Modal */}
      {isModalOpen && selectedSub && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
            <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#BCE2E8]/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

              {/* ข้อความหัวข้อสีดำเทาให้เข้ากับธีม */}
              <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                จัดการข้อมูลลูกค้า
              </h3>
              
              {/* ปุ่มปิด Modal สไตล์คลีนๆ */}
              <button 
                type="button"
                onClick={handleCloseModal} 
                className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* ข้อมูลลูกค้า */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">ลูกค้า / แพ็กเกจ</p>
                <p className="font-bold text-gray-800 text-sm mt-1">{selectedSub.users?.display_name} ({selectedSub.users?.email})</p>
                <p className="text-sm text-blue-600 font-medium">{selectedSub.products?.name}</p>
              </div>

              {/* เลือกบ้าน */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">จัดคนลงบ้าน (Master Account)</label>
                <select
                  value={editHouseId}
                  onChange={(e) => setEditHouseId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800 outline-none transition-colors"
                >
                  <option value="">-- ไม่ระบุ (เว้นว่าง) --</option>
                  {/* กรองแสดงเฉพาะบ้านที่ตรงกับ Product (เช่น บ้าน Spotify ให้เลือกเฉพาะคนซื้อ Spotify) */}
                  {masterAccounts
                    .filter(house => house.product_id === selectedSub.products?.id)
                    .map(house => (
                      <option key={house.id} value={house.id}>{house.email}</option>
                    ))
                  }
                </select>
                <p className="text-[11px] text-gray-500 mt-1.5">* เลือกอีเมลบ้าน (Family) เพื่อจัดสรรโควตาให้ลูกค้า</p>
              </div>

              {/* วันหมดอายุ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">แก้ตรงวันหมดอายุ (ต่ออายุด้วยมือ)</label>
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
                  {isProcessing ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}