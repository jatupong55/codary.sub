// src/app/admin/vault/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

interface Product {
  id: string;
  name: string;
}

interface VaultKey {
  id: string;
  product_id: string;
  license_key: string;
  status: string;
  products?: Product;
}

export default function AdminVaultPage() {
  const [keys, setKeys] = useState<VaultKey[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับ Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    product_id: '',
    license_key: '',
    status: 'available'
  });

  // ตัวกรองสินค้า (Filter)
  const [filterProductId, setFilterProductId] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. ดึงข้อมูลสินค้ามาทำ Dropdown
      const { data: prodData } = await supabase.from('products').select('id, name').order('name');
      setProducts(prodData || []);

      // 2. ดึงข้อมูล Key พร้อมชื่อสินค้า
      const { data: keyData, error } = await supabase
        .from('license_vault')
        .select(`
          id, product_id, license_key, status,
          products!license_vault_product_id_fkey ( id, name )
        `)
        .order('id', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      setKeys((keyData as unknown as VaultKey[]) || []);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      console.error('Fetch Vault Error:', error);
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (item?: VaultKey) => {
    if (item) {
      setEditId(item.id);
      setFormData({
        product_id: item.product_id,
        license_key: item.license_key,
        status: item.status
      });
    } else {
      setEditId(null);
      setFormData({
        product_id: products.length > 0 ? products[0].id : '',
        license_key: '',
        status: 'available'
      });
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

    try {
      if (editId) {
        const { error } = await supabase.from('license_vault').update(formData).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('license_vault').insert(formData);
        if (error) throw error;
      }

      handleCloseModal();
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: message });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredKeys = filterProductId === 'all' 
    ? keys 
    : keys.filter(k => k.product_id === filterProductId);

  if (isLoading) return <div className="p-10 text-center text-gray-500">กำลังโหลดข้อมูลคลังกุญแจ...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-2 border-b border-gray-100/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight leading-tight">คลังกุญแจ (Universal Vault)</h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">จัดการ License Key, Invite Link หรือรหัสสินค้าต่างๆ</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select 
            value={filterProductId} 
            onChange={(e) => setFilterProductId(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 shadow-sm outline-none shrink-0"
          >
            <option value="all">ดูทุกสินค้า</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => handleOpenModal()}
            className="shrink-0 whitespace-nowrap w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            เพิ่ม Key ใหม่
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-sm text-gray-500">
                <th className="px-6 py-4 font-medium">สินค้า</th>
                <th className="px-6 py-4 font-medium">License Key / ข้อมูล</th>
                <th className="px-6 py-4 font-medium">สถานะ</th>
                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredKeys.map((item) => (
                <tr key={item.id} className="border-b border-gray-100/50 hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{item.products?.name || 'N/A'}</td>
                  <td className="px-6 py-4 font-mono text-gray-600 bg-gray-50/50 rounded-md select-all">
                    {item.license_key}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.status === 'available' ? 'bg-[#CCF0D4] text-green-800' : 
                      item.status === 'used' ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.status === 'available' ? 'พร้อมใช้งาน' : item.status === 'used' ? 'ถูกใช้แล้ว' : 'หมดอายุ'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
              {filteredKeys.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">ไม่พบข้อมูล Key ในระบบ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-in-out ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'}`}>
            <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#BCE2E8]/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
              <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {editId ? 'แก้ไข Key' : 'เพิ่ม Key ใหม่'}
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
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">เลือกสินค้า</label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
                >
                  <option value="" disabled>-- เลือกสินค้า --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">License Key / ลิงก์</label>
                <textarea
                  required
                  rows={3}
                  value={formData.license_key}
                  onChange={(e) => setFormData({...formData, license_key: e.target.value})}
                  placeholder="กรอก Key, Serial Number หรือ Invite Link ที่นี่..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานะ</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
                >
                  <option value="available">พร้อมใช้งาน (Available)</option>
                  <option value="used">ถูกใช้แล้ว (Used)</option>
                  <option value="expired">หมดอายุ/ยกเลิก (Expired)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !formData.product_id || !formData.license_key.trim()}
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