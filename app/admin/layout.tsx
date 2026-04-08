// src/app/admin/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <div className="min-h-screen bg-gray-50 text-gray-900"/>

      {/* Sidebar สำหรับ Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white/80 backdrop-blur-xl border-r border-gray-200 z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Image 
            src="/codary-sub-full.svg" 
            alt="Codary Sub Admin Logo" 
            width={200} 
            height={50} 
            className="w-32 md:w-40 h-auto" 
            priority
          />
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.length === 0 ? (
            // แสดง Loading state ระหว่างรอข้อมูลเมนู
            <div className="animate-pulse space-y-3 px-4">
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-[#BCE2E8]/30 text-blue-800 font-semibold shadow-sm' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30">
          <span className="text-lg font-bold text-gray-800">Codary Admin</span>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </header>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-30 px-4 py-2 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg ${pathname === item.path ? 'bg-[#BCE2E8]/30 text-blue-800 font-semibold' : 'text-gray-600'}`}
              >
                {item.name}
              </Link>
            ))}
            <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-red-600 font-medium">
              ออกจากระบบ
            </button>
          </div>
        )}

        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}