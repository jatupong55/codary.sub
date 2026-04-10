'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  is_active: boolean;
  icon?: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: 0,
    description: '',
    is_active: true,
    icon: ''
  });

  const toggleActiveStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchProducts(); // รีเฟรชตารางใหม่
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'เปลี่ยนสถานะไม่สำเร็จ', text: error.message });
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setIsLoading(false);
  };

  const handleOpenModal = (prod?: Product) => {
    if (prod) {
      setEditId(prod.id);
      setFormData({ ...prod, icon: prod.icon || '' }); // ✨ ดึง icon เดิมมาใส่ฟอร์ม
    } else {
      setEditId(null);
      setFormData({ name: '', category: 'Entertainment', price: 0, description: '', is_active: true, icon: '' });
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
    try {
      if (editId) {
        await supabase.from('products').update(formData).eq('id', editId);
      } else {
        await supabase.from('products').insert(formData);
      }
      handleCloseModal();
      Swal.fire({ icon: 'success', title: 'สำเร็จ', confirmButtonColor: '#111827' });
      fetchProducts();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'พลาด', text: error.message });
    }
  };

  if (isLoading) return <div className="p-10 text-center text-gray-500">กำลังโหลด...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100/50">
        
        {/* ข้อความหัวข้อ */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight leading-tight">
            จัดการสินค้า 
            {/* ซ่อนวงเล็บให้เล็กลงและสีอ่อนลง เพื่อไม่ให้แย่งจุดเด่น */}
            <span className="text-gray-400 text-lg sm:text-xl font-medium block sm:inline mt-1 sm:mt-0 sm:ml-2">
              (Master Data)
            </span>
          </h1>
        </div>

        {/* ปุ่มเพิ่มสินค้า */}
        <button 
          onClick={() => handleOpenModal()} 
          className="shrink-0 whitespace-nowrap w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มสินค้า
        </button>

      </div>

      {/* ✨ ลด gap และ p-6 เป็น p-4 เพื่อให้ Card ดู Compact ขึ้น */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((prod) => (
          <div key={prod.id} className="bg-white/80 backdrop-blur-lg border border-gray-100 p-4 rounded-2xl shadow-sm flex flex-col transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                {/* แสดง Icon ถ้ามี ถ้าไม่มีใช้รูปกล่อง */}
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                  {prod.icon ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={prod.icon} />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  )}
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1">{prod.category}</span>
                  <h3 className="text-base font-bold text-gray-800 leading-tight line-clamp-1">{prod.name}</h3>
                </div>
              </div>
              <p className="text-lg font-black text-gray-900 shrink-0 ml-2">฿{prod.price}</p>
            </div>
            
            <p className="text-xs text-gray-500 mb-4 line-clamp-2 flex-1">{prod.description || 'ไม่มีคำอธิบาย'}</p>
            
            <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
              {/* เติม Icon ให้ปุ่มแก้ไข */}
              <button 
                onClick={() => handleOpenModal(prod)} 
                className="flex-1 flex justify-center items-center gap-1.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                แก้ไข
              </button>
              {/* เปลี่ยนปุ่มสถานะให้กดสลับไปมาได้ */}
              <button 
                onClick={() => toggleActiveStatus(prod.id, prod.is_active)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                  prod.is_active ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}
              >
                {prod.is_active ? 'เปิดขาย' : 'ปิดการขาย'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Product Modal (โครงสร้างเดียวกับ Inventory) */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ${isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
            <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#BCE2E8]/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

              {/* ข้อความหัวข้อสีดำเทาให้เข้ากับธีม */}
              <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
                {/* ไอคอนดวงดาวสีธีมที่เข้มขึ้นนิดหน่อยเพื่อให้มองเห็นชัด */}
                <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {editId ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
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
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อสินค้า</label>
                <input type="text" placeholder="เช่น Spotify Premium" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">แบรนด์สินค้า (Brand)</label>
                <input
                  type="text"
                  required
                  placeholder="พิมพ์ชื่อแบรนด์ใหม่ หรือเลือกจากปุ่มด้านล่าง"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
                />
                
                {/* ปุ่ม Quick Select สำหรับแบรนด์ฮิต (กดปุ๊บ ข้อความเข้า input ทันที) */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {['Spotify', 'Netflix', 'YouTube', 'Microsoft', 'Apple', 'Google', 'Disney', 'HBO', 'Canva'].map(brand => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setFormData({...formData, category: brand})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-sm ${
                        formData.category === brand 
                          ? 'bg-gray-900 text-white border-gray-900' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ไอคอน (SVG Path) <span className="font-normal text-gray-400 text-xs">- ถ้ามี</span></label>
                <input type="text" placeholder="M3 12l2-2m0 0l7..." value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors font-mono text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ราคา (บาท)</label>
                  <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานะตั้งต้น</label>
                  <div className="flex items-center gap-2 px-2 h-[42px] mt-1">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4 text-gray-900 rounded border-gray-300" />
                    <label className="text-sm font-medium text-gray-700">เปิดขายทันที</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">รายละเอียด</label>
                <textarea placeholder="คำอธิบายสินค้า..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors h-20 resize-none" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors">บันทึกสินค้า</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}