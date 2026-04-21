// src/app/admin/inventory/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { th } from "date-fns/locale";

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
    cost: number;
    billing_cycle: 'monthly' | 'yearly';
    status: string;
    next_renewal_date?: string;
    products?: Product;
    subscriptions?: Subscription[];
    details?: any;
}

export default function AdminInventoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState<MasterAccount[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        product_id: '',
        email: '',
        password: '',
        max_slots: 6,
        cost: 0,
        billing_cycle: 'monthly',
        status: 'active',
        next_renewal_date: '' // ใช้ string ปกติได้เลย Library จัดการให้
    });

    const [editDetails, setEditDetails] = useState({
        address: '',
        inviteLink: '',
        note: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: prodData } = await supabase
                .from('products')
                .select('id, name, category')
                .order('name');

            setProducts(prodData || []);

            const { data: accData, error: accError } = await supabase
                .from('master_accounts')
                .select(`
          id, email, password, max_slots, status, details, next_renewal_date, cost,
          products!master_accounts_product_id_fkey ( id, name, category ),
          subscriptions!subscriptions_master_account_id_fkey ( id, status )
        `)
                .order('created_at', { ascending: false });

            if (accError) throw accError;
            setAccounts((accData as any) || []);
        } catch (error: any) {
            console.error('Fetch Inventory Error:', error);
            Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message, confirmButtonColor: '#111827' });
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
                cost: account.cost ?? 0,
                billing_cycle: account.billing_cycle || 'monthly',
                status: account.status,
                next_renewal_date: account.next_renewal_date ? account.next_renewal_date.split('T')[0] : ''
            });
            setEditDetails({
                address: account.details?.address || '',
                inviteLink: account.details?.inviteLink || '',
                note: account.details?.note || ''
            });
        } else {
            setEditId(null);
            setFormData({
                product_id: products.length > 0 ? products[0].id : '',
                email: '',
                password: '',
                max_slots: 6,
                cost: 0,
                billing_cycle: 'monthly',
                status: 'active',
                next_renewal_date: ''
            });
            setEditDetails({ address: '', inviteLink: '', note: '' });
        }

        setIsModalOpen(true);
        setTimeout(() => setIsAnimating(true), 50);
    };

    const handleCloseModal = () => {
        setIsAnimating(false);
        setTimeout(() => setIsModalOpen(false), 300);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);

        const payload = {
            product_id: formData.product_id,
            email: formData.email,
            password: formData.password,
            max_slots: formData.max_slots,
            cost: formData.cost,
            billing_cycle: formData.billing_cycle,
            status: formData.status,
            next_renewal_date: formData.next_renewal_date || null,
            details: editDetails
        };

        try {
            if (editId) {
                const { error } = await supabase.from('master_accounts').update(payload).eq('id', editId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('master_accounts').insert(payload);
                if (error) throw error;
            }

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
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message, confirmButtonColor: '#ef4444' });
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
            const { error } = await supabase.from('master_accounts').delete().eq('id', id);
            if (error) throw error;

            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', text: 'ลบข้อมูลบ้านออกจากระบบแล้ว', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
            await fetchData();
        } catch (error: any) {
            Swal.fire({ icon: 'error', title: 'ลบไม่ได้', text: error.code === '23503' ? 'ไม่สามารถลบได้เนื่องจากยังมีลูกค้าเชื่อมโยงกับบ้านนี้อยู่ (ให้ย้ายลูกค้าออกก่อน)' : error.message, confirmButtonColor: '#ef4444' });
        }
    };

    if (isLoading) {
        return <div className="h-full flex items-center justify-center min-h-[400px]"><div className="animate-spin w-10 h-10 border-4 border-gray-800 border-t-transparent rounded-full"></div></div>;
    }

    const selectedProduct = products.find(p => p.id === formData.product_id);
    const isSpotify = selectedProduct?.category?.toLowerCase().trim() === 'spotify';

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100/50">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight leading-tight">ระบบจัดการ Inventory</h1>
                    <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">จัดการบัญชีหลัก (Master Accounts), ควบคุมโควตา และดูพื้นที่ว่าง</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="shrink-0 whitespace-nowrap w-full sm:w-auto justify-center px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    เพิ่มบ้านใหม่
                </button>
            </div>

            <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-200 text-sm text-gray-500">
                                <th className="px-6 py-4 font-medium">บัญชีบ้าน (Email)</th>
                                <th className="px-6 py-4 font-medium">แพ็กเกจ (Product)</th>
                                <th className="px-6 py-4 font-medium min-w-[200px]">โควตาที่ใช้ไป (Slots)</th>
                                <th className="px-6 py-4 font-medium">วันต่ออายุบ้าน</th>
                                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {accounts.map((acc) => {
                                const usedSlots = acc.subscriptions?.filter(sub => sub.status === 'active').length || 0;
                                const maxSlots = acc.max_slots;
                                const percentFull = Math.min((usedSlots / maxSlots) * 100, 100);
                                const isFull = usedSlots >= maxSlots;

                                const isExpired = acc.next_renewal_date && new Date(acc.next_renewal_date) < new Date();

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
                                            <span className={`ml-1.5 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${acc.billing_cycle === 'yearly'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {acc.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 min-w-[200px]">
                                            <div className="flex items-center justify-between text-xs mb-1 gap-4 whitespace-nowrap">
                                                <span className="font-semibold text-gray-700">{usedSlots} / {maxSlots}</span>
                                                <span className={isFull ? 'text-red-500 font-bold' : 'text-green-600 font-medium'}>
                                                    {isFull ? 'เต็มแล้ว' : `ว่าง ${maxSlots - usedSlots} ที่`}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                <div className={`h-2 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percentFull}%` }}></div>
                                            </div>
                                        </td>

                                        {/* [UPDATE] แสดงผลในตารางแบบ วัน/เดือน/ปี (DD/MM/YYYY) */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {acc.next_renewal_date ? (
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${isExpired ? 'bg-red-100 text-red-700' : 'text-gray-700'}`}>
                                                    {new Date(acc.next_renewal_date).toLocaleDateString('th-TH', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">ไม่ได้ระบุ</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleOpenModal(acc)} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors shadow-sm">แก้ไข</button>
                                                <button onClick={() => handleDelete(acc.id, acc.email)} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors shadow-sm">ลบ</button>
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

            {isModalOpen && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
                    <div className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
                        <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#BCE2E8]/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                            <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                {editId ? 'แก้ไขข้อมูลบ้าน' : 'เพิ่มบ้านใหม่'}
                            </h3>
                            <button type="button" onClick={handleCloseModal} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">แพ็กเกจสินค้า</label>
                                <select
                                    required
                                    value={formData.product_id}
                                    onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
                                >
                                    <option value="" disabled>-- เลือกแพ็กเกจ --</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ต้นทุน/รอบ (บาท)</label>
                                    <input type="number" min="0" step="0.01" value={formData.cost}
                                        onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                        placeholder="เช่น 180.00"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all" />
                                </div>

                                {/* ✅ เพิ่มตรงนี้ */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">รอบบิลของบ้าน</label>
                                    <select
                                        value={formData.billing_cycle}
                                        onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
                                    >
                                        <option value="monthly">รายเดือน</option>
                                        <option value="yearly">รายปี</option>
                                    </select>
                                </div>
                            </div>

                            {/* ส่วน Datepicker แบบ Modern ที่ส่งค่า YYYY-MM-DD เข้าฐานข้อมูลอัตโนมัติ */}
                            <div className="relative z-[100]">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between">
                                    <span>กำหนดวันต่ออายุแพ็กเกจหลัก</span>
                                    <span className="text-xs text-gray-400 font-normal">ไม่ต้องกรอกก็ได้</span>
                                </label>
                                <DatePicker
                                    // 1. อ่านค่าจาก String YYYY-MM-DD มาโชว์เป็นปฏิทิน
                                    selected={formData.next_renewal_date ? new Date(formData.next_renewal_date) : null}

                                    // 2. เมื่อกดเลือกวัน ให้แปลงกลับเป็น YYYY-MM-DD ส่งเข้า Database
                                    onChange={(date: Date | null) => {
                                        setFormData({
                                            ...formData,
                                            next_renewal_date: date ? format(date, 'yyyy-MM-dd') : ''
                                        });
                                    }}
                                    dateFormat="dd/MM/yyyy"
                                    locale={th}
                                    placeholderText="วัน/เดือน/ปี"
                                    isClearable
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
                                    wrapperClassName="w-full"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">ใช้เพื่อเตือนแอดมินว่าต้องนำเงินไปจ่ายต้นทางเมื่อไหร่</p>
                            </div>

                            <div className="pt-2 border-t border-gray-100 mt-4">
                                <h4 className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-wider">ข้อมูลเพิ่มเติม (Details)</h4>

                                {isSpotify ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">ที่อยู่ครอบครัว</label>
                                            <input
                                                type="text"
                                                placeholder="กรอกที่อยู่สำหรับยืนยันตัวตน"
                                                value={editDetails.address}
                                                onChange={(e) => setEditDetails({ ...editDetails, address: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">ลิงก์คำเชิญ (Invite Link)</label>
                                            <input
                                                type="text"
                                                placeholder="https://www.spotify.com/th/family/join/..."
                                                value={editDetails.inviteLink}
                                                onChange={(e) => setEditDetails({ ...editDetails, inviteLink: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">หมายเหตุถึงลูกค้า (Note)</label>
                                        <textarea
                                            placeholder="คำแนะนำ หรือข้อมูลการเข้าสู่ระบบ..."
                                            value={editDetails.note}
                                            onChange={(e) => setEditDetails({ ...editDetails, note: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none h-16 resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานะบัญชี</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
                                >
                                    <option value="active">เปิดใช้งาน (Active)</option>
                                    <option value="disabled">ระงับชั่วคราว (Disabled)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={handleCloseModal} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">ยกเลิก</button>
                                <button type="submit" disabled={isProcessing || !formData.product_id} className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
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