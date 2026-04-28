// src/app/admin/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Swal from 'sweetalert2';

// สร้าง Interface สำหรับรับค่าข้อมูลเมนู
interface MenuItem {
  id: number;
  name: string;
  path: string;
  icon: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isContentVisible, setIsContentVisible] = useState(false);

  // ดึงข้อมูลเมนูจากฐานข้อมูลเมื่อ Component โหลด
  useEffect(() => {
    const fetchMenus = async () => {
      const { data, error } = await supabase
        .from('admin_menus')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (data && !error) {
        setMenuItems(data);
      } else {
        console.error('Error fetching menus:', error);
      }
    };

    fetchMenus();
  }, []);

  useEffect(() => {
    setIsContentVisible(false); // เริ่มต้นให้โปร่งใสก่อน
    const timer = setTimeout(() => setIsContentVisible(true), 50); // หน่วง 50ms ให้ DOM อัปเดตเนื้อหาใหม่ แล้วค่อยโชว์
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleLogout = async () => {
    Swal.fire({
      title: 'กำลังออกจากระบบ...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    await supabase.auth.signOut();
    Swal.close();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden text-gray-900">
      {/* 1. พื้นหลังเบลอสำหรับ Mobile (Backdrop) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-20 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 2. Sidebar (เป็นทั้ง Drawer ของ Mobile และ Aside ของ Desktop) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white/90 md:bg-white/80 backdrop-blur-xl border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } md:relative`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <Image 
            src="/codary-sub-full.svg" 
            alt="Codary Sub Admin" 
            width={160} 
            height={40} 
            className="w-32 h-auto" 
            priority
          />
          {/* ปุ่มปิด Sidebar สำหรับ Mobile */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {menuItems.length === 0 ? (
            <div className="animate-pulse space-y-3 px-2">
              <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
              <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
            </div>
          ) : (
            menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)} // กดเมนูแล้วปิด Drawer อัตโนมัติ (สำหรับ Mobile)
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-gray-900 text-white font-semibold shadow-md' // ปรับสี Active ให้ดู Premium ขึ้น
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.name}
                </Link>
              );
            })
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* 3. Main Content Area */}
      {/* เปลี่ยนจาก overflow-y-auto เป็น overflow-y-scroll เพื่อบังคับให้ Scrollbar แสดงตลอดเวลา ป้องกันจอกระตุกซ้ายขวา */}
      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-y-scroll">
        
        {/* Mobile Header: เปลี่ยนเป็นสไตล์ Profile สุดพรีเมียม */}
        <header className="md:hidden h-16 min-h-[64px] shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-10">
          
          {/* ฝั่งซ้าย: ปุ่มเมนู */}
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* ฝั่งขวา: Profile Admin */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800">ผู้ดูแลระบบ</span>
              <span className="text-[10px] font-medium text-green-700 bg-[#CCF0D4] px-2 py-0.5 rounded-full border border-green-200">
                ● ออนไลน์
              </span>
            </div>
            {/* รูป Avatar: ใช้ Gradient สีดำเทาให้ดูดุดันแบบบอส */}
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-gray-900 to-gray-600 flex items-center justify-center text-white shadow-md ring-2 ring-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

        </header>

        {/* ส่วนนี้ของเดิม ไม่ต้องแก้ */}
        <div
          className={`p-4 md:p-8 transition-opacity duration-300 ease-in-out ${isContentVisible ? 'opacity-100' : 'opacity-0'
            }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}