// src/app/admin/layout.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ดึงข้อมูลเมนูและโปรไฟล์
  useEffect(() => {
    const loadData = async () => {
      // 1. ดึงเมนู
      const { data: menuData } = await supabase
        .from('admin_menus')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (menuData) setMenuItems(menuData);

      // 2. ดึงโปรไฟล์
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        setUserProfile({
          ...dbUser,
          email: session.user.email,
          avatar_url: session.user.user_metadata?.avatar_url
        });
      }
    };

    loadData();

    // ปิดเมนูเมื่อคลิกข้างนอก
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsContentVisible(false);
    const timer = setTimeout(() => setIsContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    Swal.fire({
      title: 'กำลังออกจากระบบ...',
      text: 'ขอบคุณที่ทำงานหนักในวันนี้ครับบอส! 😊',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
      customClass: {
        popup: 'rounded-[2rem] p-6 md:p-10 border border-gray-100 shadow-2xl',
      },
      width: '90%',
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
    await supabase.auth.signOut();
    Swal.close();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden text-gray-900 font-sans">
      {/* 1. Backdrop สำหรับ Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 2. Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } md:relative`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 bg-white">
          <Image
            src="/codary-sub-full.svg"
            alt="Codary Sub Admin"
            width={160}
            height={40}
            className="w-32 h-auto"
            priority
          />
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto bg-white">
          {menuItems.length === 0 ? (
            <div className="animate-pulse space-y-3 px-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl w-full"></div>)}
            </div>
          ) : (
            menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                      ? 'bg-[#10B981] text-white font-bold shadow-lg shadow-green-100'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })
          )}
        </nav>

        <div className="p-6 border-t border-gray-50 bg-white text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Codary Admin v1.0</p>
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-y-auto">
        
        {/* Universal Top Header */}
        <header className="h-16 min-h-[64px] shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="hidden md:block text-sm font-bold text-gray-400 uppercase tracking-widest">
              Admin Control Panel
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2 hidden sm:flex">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Administrator</span>
              <span className="text-sm font-bold text-gray-800">{userProfile?.display_name || 'Admin'}</span>
            </div>

            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-1 rounded-full transition-all duration-300 border-2 ${isMenuOpen ? 'border-[#10B981] bg-gray-50 scale-105 shadow-md' : 'border-transparent'}`}
              >
                <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-gradient-to-tr from-gray-800 to-gray-600 flex items-center justify-center text-white shadow-md overflow-hidden border border-white">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Admin" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Profile Dropdown (Expanded) */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-md rounded-[2rem] shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-6 py-3 mb-2 border-b border-gray-50">
                    <p className="text-[10px] font-bold text-[#10B981] uppercase tracking-widest mb-1">Admin Account</p>
                    <p className="text-sm font-bold text-gray-800 truncate">{userProfile?.display_name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{userProfile?.email}</p>
                  </div>

                  <Link 
                    href="/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 text-gray-700 hover:bg-green-50 transition-colors group"
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-green-100 text-[#10B981] group-hover:bg-[#10B981] group-hover:text-white transition-all">🏠</span>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold">กลับหน้าหลัก (User)</span>
                      <span className="text-[10px] text-gray-400">เข้าสู่ Dashboard ลูกค้า</span>
                    </div>
                  </Link>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-5 py-3 text-red-600 hover:bg-red-50 transition-colors group"
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </span>
                    <span className="text-[12px] font-bold">ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`p-4 md:p-8 transition-opacity duration-300 ease-in-out ${isContentVisible ? 'opacity-100' : 'opacity-0'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}