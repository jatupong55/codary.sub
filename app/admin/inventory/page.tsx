// src/app/admin/inventory/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import InventoryModal from '@/components/admin/InventoryModal';
import { formatCurrency } from '@/utils/subscriptionUtils';
import type { MasterAccount, Product, InventoryFormData, InventoryDetailsData } from '@/types/admin';

export default function AdminInventoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState<MasterAccount[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState<InventoryFormData>({
        product_id: '',
        email: '',
        password: '',
        max_slots: 6,
        cost: 0,
        billing_cycle: 'monthly',
        status: 'active',
        next_renewal_date: '',
    });

    const [editDetails, setEditDetails] = useState<InventoryDetailsData>({
        address: '',
        inviteLink: '',
        note: '',
    });

    // สำหรับดูสมาชิกในบ้าน
    const [selectedHouse, setSelectedHouse] = useState<MasterAccount | null>(null);
    const [isHouseDetailOpen, setIsHouseDetailOpen] = useState(false);
    const [houseMembers, setHouseMembers] = useState<any[]>([]);
    const [isFetchingMembers, setIsFetchingMembers] = useState(false);

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
                  id, email, password, max_slots, status, details, next_renewal_date, cost, billing_cycle, 
                  products!master_accounts_product_id_fkey ( id, name, category ),
                  subscriptions!subscriptions_master_account_id_fkey ( id, status )
                `)
                .order('created_at', { ascending: false });

            if (accError) throw accError;
            setAccounts((accData as unknown as MasterAccount[]) || []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
            Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: message, confirmButtonColor: '#111827' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewMembers = async (account: MasterAccount) => {
        setSelectedHouse(account);
        setIsHouseDetailOpen(true);
        setIsFetchingMembers(true);
        try {
            const { data: members } = await supabase
                .from('subscriptions')
                .select('id, start_date, end_date, status, users(display_name, email)')
                .eq('master_account_id', account.id)
                .eq('status', 'active');
            setHouseMembers(members || []);
        } catch (error) {
            console.error('Error fetching house members:', error);
        } finally {
            setIsFetchingMembers(false);
        }
    };

    const handleOpenModal = (account?: MasterAccount) => {
        if (account) {
            setEditId(account.id);
            const product = Array.isArray(account.products) ? account.products[0] : (account.products as any);
            setFormData({
                product_id: product?.id || '',
                email: account.email,
                password: account.password || '',
                max_slots: account.max_slots,
                cost: account.cost ?? 0,
                billing_cycle: account.billing_cycle || 'monthly',
                status: account.status,
                next_renewal_date: account.next_renewal_date ? account.next_renewal_date.split('T')[0] : '',
            });
            setEditDetails({
                address: account.details?.address || '',
                inviteLink: account.details?.inviteLink || '',
                note: account.details?.note || '',
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
                next_renewal_date: '',
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
            details: editDetails,
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
                customClass: { popup: 'rounded-2xl' },
            });
            await fetchData();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: message, confirmButtonColor: '#ef4444' });
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
            customClass: { popup: 'rounded-2xl' },
        });

        if (!confirmResult.isConfirmed) return;

        try {
            const { error } = await supabase.from('master_accounts').delete().eq('id', id);
            if (error) throw error;

            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', text: 'ลบข้อมูลบ้านออกจากระบบแล้ว', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
            await fetchData();
        } catch (error: unknown) {
            const isFK = (error as { code?: string })?.code === '23503';
            const message = isFK
                ? 'ไม่สามารถลบได้เนื่องจากยังมีลูกค้าเชื่อมโยงกับบ้านนี้อยู่ (ให้ย้ายลูกค้าออกก่อน)'
                : error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
            Swal.fire({ icon: 'error', title: 'ลบไม่ได้', text: message, confirmButtonColor: '#ef4444' });
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[400px]">
                <div className="animate-spin w-10 h-10 border-4 border-gray-800 border-t-transparent rounded-full" />
            </div>
        );
    }

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
                                <th className="px-6 py-4 font-medium min-w-[200px]">ความหนาแน่น (Slots)</th>
                                <th className="px-6 py-4 font-medium text-right">กำไร (Profit/mo)</th>
                                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {accounts.map((acc) => {
                                const usedSlots = acc.subscriptions?.filter((sub) => sub.status === 'active').length || 0;
                                const maxSlots = acc.max_slots;
                                // ✅ Bug Fix: ป้องกัน division by zero เมื่อ maxSlots = 0
                                const percentFull = maxSlots > 0 ? Math.min((usedSlots / maxSlots) * 100, 100) : 0;
                                const isFull = usedSlots >= maxSlots;
                                const isExpired = acc.next_renewal_date && new Date(acc.next_renewal_date) < new Date();

                                return (
                                <tr key={acc.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-all group">
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => handleViewMembers(acc)}
                                            className="text-left group/btn"
                                        >
                                            <div className="font-bold text-gray-800 group-hover/btn:text-blue-600 transition-colors flex items-center gap-1.5">
                                                {acc.email}
                                                <svg className="w-3.5 h-3.5 opacity-0 group-hover/btn:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">PWD: {acc.password || 'ไม่ระบุ'}</div>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                                            {(() => {
                                                const product = Array.isArray(acc.products) ? acc.products[0] : (acc.products as any);
                                                return product?.name || 'N/A';
                                            })()}
                                        </span>
                                        <div className="mt-1">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${acc.billing_cycle === 'yearly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {acc.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 min-w-[200px]">
                                        <div className="flex items-center justify-between text-xs mb-1 gap-4 whitespace-nowrap">
                                            <span className="font-semibold text-gray-700">{usedSlots} / {maxSlots}</span>
                                            <span className={isFull ? 'text-red-500 font-bold' : 'text-green-600 font-medium'}>
                                                {isFull ? 'เต็มแล้ว' : `ว่าง ${maxSlots - usedSlots} ที่`}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-1.5 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`}
                                                style={{ width: `${percentFull}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {(() => {
                                            const product = Array.isArray(acc.products) ? acc.products[0] : (acc.products as any);
                                            const productPrice = product?.price || 0;
                                            const estimatedRevenue = usedSlots * productPrice;
                                            const monthlyCost = acc.billing_cycle === 'yearly' ? (acc.cost || 0) / 12 : (acc.cost || 0);
                                            const profit = estimatedRevenue - monthlyCost;

                                            return (
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        ฿{formatCurrency(profit)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">หักต้นทุนแล้ว</span>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleOpenModal(acc)} className="p-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => handleDelete(acc.id, acc.email)} className="p-2 bg-white border border-red-100 text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-sm active:scale-95">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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

            {/* === Member Details Drawer === */}
            {isHouseDetailOpen && (
                <div className="fixed inset-0 z-[60] overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsHouseDetailOpen(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl transition-transform duration-300">
                        <div className="h-full flex flex-col p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800">สมาชิกในบ้าน</h2>
                                    <p className="text-sm text-gray-500 mt-1">{selectedHouse?.email}</p>
                                </div>
                                <button onClick={() => setIsHouseDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4">
                                {isFetchingMembers ? (
                                    [1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)
                                ) : houseMembers.length > 0 ? (
                                    houseMembers.map(member => (
                                        <div key={member.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-gray-800">{member.users?.display_name || 'ไม่ทราบชื่อ'}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{member.users?.email}</p>
                                                </div>
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">ACTIVE</span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-3">
                                                <span>เริ่ม: {new Date(member.start_date).toLocaleDateString('th-TH')}</span>
                                                <span className="font-bold text-gray-600">สิ้นสุด: {new Date(member.end_date).toLocaleDateString('th-TH')}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm">
                                        <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        ยังไม่มีสมาชิกในบ้านหลังนี้
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 p-4 rounded-2xl bg-gray-900 text-white flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">สถานะปัจจุบัน</p>
                                    <p className="text-lg font-black">{houseMembers.length} / {selectedHouse?.max_slots} ที่นั่ง</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">กำไรโดยประมาณ</p>
                                    <p className="text-lg font-black text-green-400">
                                        {(() => {
                                            const product = Array.isArray(selectedHouse?.products) ? selectedHouse?.products[0] : (selectedHouse?.products as any);
                                            const profit = (houseMembers.length * (product?.price || 0)) - (selectedHouse?.billing_cycle === 'yearly' ? (selectedHouse?.cost || 0) / 12 : (selectedHouse?.cost || 0));
                                            return `฿${formatCurrency(profit)}`;
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <InventoryModal
                isOpen={isModalOpen}
                isAnimating={isAnimating}
                editId={editId}
                formData={formData}
                editDetails={editDetails}
                products={products}
                isProcessing={isProcessing}
                onClose={handleCloseModal}
                onSave={handleSave}
                onFormChange={setFormData}
                onDetailsChange={setEditDetails}
            />
        </div>

    );
}