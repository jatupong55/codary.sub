// src/app/admin/customers/page.tsx
'use client';

import { useEffect, useState } from 'react';
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

  // State สำหรับ Modal จัดการลูกค้า
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionData | null>(null);
  
  // State สำหรับฟอร์มใน Modal
  const [editEndDate, setEditEndDate] = useState('');
  const [editHouseId, setEditHouseId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
          users!subscriptions_user_id_fkey ( display_name, email ),
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

  // เปิด Modal พร้อมตั้งค่าเริ่มต้น
  const openEditModal = (sub: SubscriptionData) => {
    setSelectedSub(sub);
    setEditEndDate(sub.end_date);
    setEditHouseId(sub.master_account_id || '');
    setIsModalOpen(true);
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

      setIsModalOpen(false);
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
                <th className="px-6 py-4 font-medium">แพ็กเกจ</th>
                <th className="px-6 py-4 font-medium">บ้านที่ใช้งาน (Inventory)</th>
                <th className="px-6 py-4 font-medium">วันหมดอายุ</th>
                <th className="px-6 py-4 font-medium">สถานะ</th>
                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {subscriptions.map((sub) => {
                const isExpired = new Date(sub.end_date) < new Date();
                return (
                  <tr key={sub.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{sub.users?.display_name || 'ไม่ระบุชื่อ'}</div>
                      <div className="text-xs text-gray-500">{sub.users?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {sub.products?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {sub.master_accounts ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                          {sub.master_accounts.email}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">ยังไม่จัดบ้าน</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>
                        {new Date(sub.end_date).toLocaleDateString('th-TH')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        sub.status === 'active' && !isExpired ? 'bg-[#CCF0D4] text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {isExpired ? 'หมดอายุ' : sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        จัดการ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">จัดการข้อมูลลูกค้า</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-800 focus:border-gray-800 outline-none transition-all"
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
                  onClick={() => setIsModalOpen(false)}
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