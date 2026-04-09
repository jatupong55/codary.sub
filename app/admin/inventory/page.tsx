// src/app/admin/inventory/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

interface Product {
    id: string;
    name: string;
    category: string;
}

interface Subscription {
    id: string;
    status: string;
}

interface MasterAccount {
    id: string;
    email: string;
    password?: string;
    max_slots: number;
    status: string;
    products?: Product;
    subscriptions?: Subscription[];
}

export default function AdminInventoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState<MasterAccount[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // State สำหรับ Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // State ฟอร์ม
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        product_id: '',
        email: '',
        password: '',
        max_slots: 6,
        status: 'active'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. ดึงข้อมูลสินค้ามาทำ Dropdown
            const { data: prodData } = await supabase
                .from('products')
                .select('id, name, category')
                .order('name');

            setProducts(prodData || []);

            // 2. ดึงข้อมูลบ้าน พร้อมพ่วงข้อมูลแพ็กเกจย่อยมานับจำนวนคน
            const { data: accData, error: accError } = await supabase
                .from('master_accounts')
                .select(`
          id, email, password, max_slots, status,
          products!master_accounts_product_id_fkey ( id, name, category ),
          subscriptions!subscriptions_master_account_id_fkey ( id, status )
        `)
                .order('created_at', { ascending: false });

            if (accError) throw accError;

            setAccounts((accData as any) || []);

        } catch (error: any) {
            console.error('Fetch Inventory Error:', error);
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

    const handleOpenModal = (account?: MasterAccount) => {
    if (account) {
      setEditId(account.id);
      setFormData({
        product_id: account.products?.id || '',
        email: account.email,
        password: account.password || '',
        max_slots: account.max_slots,
        status: account.status
      });
    } else {
      setEditId(null);
      setFormData({
        product_id: products.length > 0 ? products[0].id : '',
        email: '',
        password: '',
        max_slots: 6,
        status: 'active'
      });
    }
    
    // 1. สั่งให้ Modal ปรากฏใน DOM ก่อน (แต่ยังโปร่งใสอยู่)
    setIsModalOpen(true);
    
    // 2. หน่วงเวลา 50ms แล้วค่อยเล่นแอนิเมชันเด้งขึ้นมา
    setTimeout(() => setIsAnimating(true), 50);
  };

  const handleCloseModal = () => {
    // 1. เล่นแอนิเมชันเฟดออก/หดลง
    setIsAnimating(false);
    
    // 2. หน่วงเวลา 300ms (เท่ากับความยาวแอนิเมชัน) ค่อยเอาออกจาก DOM
    setTimeout(() => setIsModalOpen(false), 300);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      if (editId) {
        const { error } = await supabase
          .from('master_accounts')
          .update({
            product_id: formData.product_id,
            email: formData.email,
            password: formData.password,
            max_slots: formData.max_slots,
            status: formData.status
          })
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('master_accounts')
          .insert({
            product_id: formData.product_id,
            email: formData.email,
            password: formData.password,
            max_slots: formData.max_slots,
            status: formData.status
          });
        if (error) throw error;
      }

      // ✨ เปลี่ยนมาใช้ handleCloseModal() แทน setIsModalOpen(false) ดื้อๆ
      handleCloseModal(); 
      
      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: editId ? 'อัปเดตข้อมูลบ้านเรียบร้อย' : 'เพิ่มบ้านหลังใหม่เรียบร้อย',
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

    const handleDelete = async (id: string, email: string) => {
        const confirmResult = await Swal.fire({
            title: 'ยืนยันการลบ?',
            html: `คุณต้องการลบบ้าน <b>${email}</b> ใช่หรือไม่?<br/><span class="text-xs text-red-500">หมายเหตุ: จะลบได้ก็ต่อเมื่อไม่มีลูกค้าอยู่ในบ้านนี้แล้ว</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก',
            customClass: { popup: 'rounded-2xl' }
        });

        if (!confirmResult.isConfirmed) return;

        try {
            const { error } = await supabase
                .from('master_accounts')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ!',
                text: 'ลบข้อมูลบ้านออกจากระบบแล้ว',
                confirmButtonColor: '#111827',
                customClass: { popup: 'rounded-2xl' }
            });
            await fetchData();
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'ลบไม่ได้',
                text: error.code === '23503' ? 'ไม่สามารถลบได้เนื่องจากยังมีลูกค้าเชื่อมโยงกับบ้านนี้อยู่ (ให้ย้ายลูกค้าออกก่อน)' : error.message,
                confirmButtonColor: '#ef4444'
            });
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
                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight">ระบบจัดการ Inventory</h1>
                    <p className="text-gray-500 mt-2">จัดการบัญชีหลัก (Master Accounts), ควบคุมโควตา และดูพื้นที่ว่าง</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    เพิ่มบ้านใหม่
                </button>
            </div>

            {/* Table */}
            <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-200 text-sm text-gray-500">
                                <th className="px-6 py-4 font-medium">บัญชีบ้าน (Email)</th>
                                <th className="px-6 py-4 font-medium">แพ็กเกจ (Product)</th>
                                <th className="px-6 py-4 font-medium min-w-[200px]">โควตาที่ใช้ไป (Slots)</th>
                                <th className="px-6 py-4 font-medium">สถานะ</th>
                                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {accounts.map((acc) => {
                                // คำนวณจำนวนคนที่ Active ในบ้านนี้
                                const usedSlots = acc.subscriptions?.filter(sub => sub.status === 'active').length || 0;
                                const maxSlots = acc.max_slots;
                                const percentFull = Math.min((usedSlots / maxSlots) * 100, 100);
                                const isFull = usedSlots >= maxSlots;

                                return (
                                    <tr key={acc.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{acc.email}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">PWD: {acc.password || 'ไม่ระบุ'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                                                {acc.products?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-semibold text-gray-700">{usedSlots} / {maxSlots}</span>
                                                <span className={isFull ? 'text-red-500 font-bold' : 'text-green-600 font-medium'}>
                                                    {isFull ? 'เต็มแล้ว' : `ว่าง ${maxSlots - usedSlots} ที่`}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`}
                                                    style={{ width: `${percentFull}%` }}
                                                ></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${acc.status === 'active' ? 'bg-[#CCF0D4] text-green-800' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                {acc.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(acc)}
                                                    className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors shadow-sm"
                                                >
                                                    แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(acc.id, acc.email)}
                                                    className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors shadow-sm"
                                                >
                                                    ลบ
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {accounts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        ยังไม่มีบัญชีบ้านในระบบ (กดเพิ่มบ้านใหม่ที่ปุ่มมุมขวาบน)
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{editId ? 'แก้ไขข้อมูลบ้าน' : 'เพิ่มบ้านใหม่'}</h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">แพ็กเกจสินค้า</label>
                                <select
                                    required
                                    value={formData.product_id}
                                    onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                                >
                                    <option value="" disabled>-- เลือกแพ็กเกจ --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">อีเมลบ้าน (Master Account Email)</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="เช่น spotify_family1@gmail.com"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">รหัสผ่าน (ถ้ามี)</label>
                                    <input
                                        type="text"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="รหัสผ่านเข้าเมล"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">โควตาสูงสุด (Slots)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={formData.max_slots}
                                        onChange={(e) => setFormData({ ...formData, max_slots: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานะบัญชี</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                                >
                                    <option value="active">เปิดใช้งาน (Active)</option>
                                    <option value="disabled">ระงับชั่วคราว (Disabled)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                {/* ... ปุ่มยกเลิกและบันทึก คงเดิม ... */}
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing || !formData.product_id}
                                    className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    {isProcessing ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}