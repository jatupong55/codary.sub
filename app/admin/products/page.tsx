// src/app/admin/products/page.tsx
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
  bg_color?: string;
}

const getBrandStyle = (category: string) => {
  const safeCategory = category?.toLowerCase()?.trim() || '';
  const styles: Record<string, { bg: string, logo: string }> = {
    spotify: { bg: 'bg-[#191414]', logo: 'https://cdn.simpleicons.org/spotify/1DB954' },
    netflix: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/netflix/E50914' },
    youtube: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/youtube/FF0000' },
    disney: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
    hbo: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/hbo/ffffff' },
    viu: { bg: 'bg-[#121212]', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Viu_logo.svg' },
    canva: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Canva_logo.svg' },
    google: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/google/4285F4' },
    apple: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/apple/ffffff' },
    nintendo: { bg: 'bg-white border border-gray-100', logo: 'https://www.nintendo.co.jp/common/v2/img/ncommon/_common/logo/switch.svg' },
    ms365: { bg: 'bg-white border border-gray-100', logo: 'https://files.brandlogos.net/svg/RwAX3bZKbl/microsoft-365-copilot-logo-brandlogos.net_78lfgdevk.svg' },
  };
  return styles[safeCategory] || { bg: 'bg-gray-50 border border-gray-200', logo: '' };
};

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
    icon: '',
    bg_color: '#f3f4f6'
  });

  const toggleActiveStatus = async (id: string, currentStatus: boolean, productName: string) => {
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'เปิดขาย' : 'ปิดการขาย';
    const actionColor = newStatus ? '#10b981' : '#ef4444'; // สีเขียวสำหรับเปิด สีแดงสำหรับปิด

    const confirmResult = await Swal.fire({
      title: `ยืนยันการ${actionText}?`,
      html: `คุณต้องการ${actionText}สินค้า <b>${productName}</b> ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: actionColor,
      cancelButtonColor: '#9ca3af',
      confirmButtonText: `ใช่, ${actionText}เลย!`,
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus })
        .eq('id', id);
        
      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: `เปลี่ยนสถานะเป็น${actionText}เรียบร้อยแล้ว`,
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });
      
      fetchProducts();
    } catch (error: any) {
      Swal.fire({ 
        icon: 'error', 
        title: 'เปลี่ยนสถานะไม่สำเร็จ', 
        text: error.message, 
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
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
      setFormData({ 
        ...prod, 
        icon: prod.icon || '',
        bg_color: prod.bg_color || '#f3f4f6'
      });
    } else {
      setEditId(null);
      setFormData({ name: '', category: 'Netflix', price: 0, description: '', is_active: true, icon: '', bg_color: '#f3f4f6' });
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
      const payload = {
        name: formData.name,
        category: formData.category,
        price: Number(formData.price),
        description: formData.description,
        is_active: formData.is_active,
        icon: formData.icon,
        bg_color: formData.bg_color
      };

      if (editId) {
        const { data, error } = await supabase.from('products').update(payload).eq('id', editId).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('ฐานข้อมูลปฏิเสธการแก้ไข (โปรดตรวจสอบ RLS Policy)');
      } else {
        const { data, error } = await supabase.from('products').insert([payload]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('ฐานข้อมูลปฏิเสธการเพิ่มข้อมูล (โปรดตรวจสอบ RLS Policy)');
      }
      
      handleCloseModal();
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', confirmButtonColor: '#111827', customClass: { popup: 'rounded-2xl' } });
      fetchProducts();
    } catch (error: any) {
      console.error('Save Product Error:', error);
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message, confirmButtonColor: '#ef4444' });
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight leading-tight">
            จัดการสินค้า 
            <span className="text-gray-400 text-lg sm:text-xl font-medium block sm:inline mt-1 sm:mt-0 sm:ml-2">
              (Master Data)
            </span>
          </h1>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="shrink-0 whitespace-nowrap w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          เพิ่มสินค้า
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((prod) => {
          const brandStyle = getBrandStyle(prod.category);
          const iconSource = prod.icon || brandStyle.logo;
          const isUrl = iconSource?.startsWith('http') || iconSource?.startsWith('data:image');
          
          // ใช้สีจาก DB หากตั้งค่าไว้ ถ้าไม่ได้ตั้ง (หรือเป็นค่าเริ่มต้น) ให้ถอยไปใช้ brandStyle.bg
          const useDatabaseColor = prod.bg_color && prod.bg_color !== '#f3f4f6';
          const containerStyle = useDatabaseColor ? { backgroundColor: prod.bg_color } : {};
          const fallbackClass = useDatabaseColor ? '' : brandStyle.bg;

          return (
            <div key={prod.id} className="bg-white/80 backdrop-blur-lg border border-gray-100 p-4 rounded-2xl shadow-sm flex flex-col transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-4">
                  
                  {/* กล่องโลโก้ที่แสดงสีพื้นหลังแบบไดนามิก */}
                  <div 
                    className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 overflow-hidden shadow-sm ${fallbackClass}`}
                    style={containerStyle}
                  >
                    {isUrl ? (
                      <img src={iconSource} alt={prod.category} className="w-6 h-6 object-contain" />
                    ) : iconSource ? (
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconSource} />
                      </svg>
                    ) : (
                      <span className="text-gray-400 font-black text-lg">{prod.category?.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block mb-1">{prod.category}</span>
                    <h3 className="text-base font-bold text-gray-800 leading-tight line-clamp-1">{prod.name}</h3>
                  </div>
                </div>
                <p className="text-lg font-black text-gray-900 shrink-0 ml-2">฿{prod.price}</p>
              </div>
              
              <p className="text-xs text-gray-500 mb-4 line-clamp-2 flex-1 mt-2">{prod.description || 'ไม่มีคำอธิบาย'}</p>
              
              <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                <button onClick={() => handleOpenModal(prod)} className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  แก้ไข
                </button>
                <button 
                  onClick={() => toggleActiveStatus(prod.id, prod.is_active, prod.name)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors border ${
                    prod.is_active ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {prod.is_active ? 'เปิดขาย' : 'ปิดการขาย'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ${isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
            <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                {editId ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อสินค้า</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors" />
              </div>
              
              {/* ปรับให้เป็น 1 คอลัมน์บนมือถือ และ 2 คอลัมน์บนจอใหญ่ เพื่อป้องกันการล้น */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">แบรนด์</label>
                  <input type="text" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors" />
                </div>
                <div className="overflow-hidden">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">สีพื้นหลังโลโก้</label>
                  <div className="flex items-center gap-2">
                    {/* เพิ่ม shrink-0 ป้องกันการหดตัว */}
                    <input type="color" value={formData.bg_color} onChange={e => setFormData({...formData, bg_color: e.target.value})} className="w-10 h-10 p-0 border-0 rounded cursor-pointer shrink-0" />
                    {/* เพิ่ม min-w-0 ป้องกันการขยายตัวจนล้นกรอบ */}
                    <input type="text" value={formData.bg_color} onChange={e => setFormData({...formData, bg_color: e.target.value})} className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white font-mono uppercase outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ไอคอน (URL รูปภาพ หรือ SVG Path)</label>
                <input type="text" placeholder="https://..." value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none font-mono text-xs" />
              </div>

              {/* ปรับ Grid ตรงส่วนราคาและสถานะเช่นกันเพื่อความปลอดภัย */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ราคา (บาท)</label>
                  <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานะตั้งต้น</label>
                  <div className="flex items-center gap-2 h-[42px]">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4 text-gray-900 rounded border-gray-300 shrink-0" />
                    <label className="text-sm font-medium text-gray-700 cursor-pointer" onClick={() => setFormData({...formData, is_active: !formData.is_active})}>เปิดขายทันที</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">รายละเอียด</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none h-20 resize-none" />
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