import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { UserProfile } from '@/types/dashboard';
import Link from 'next/link';

interface HeaderProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export default function Header({ userProfile, onLogout }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!userProfile) return null;

  return (
    <header className="relative bg-white rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between mb-8 p-4 md:p-6 transition-all duration-300 hover:shadow-md z-40">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none rounded-[2rem] overflow-hidden"></div>
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00C300]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 shrink">
        <Image
          src="/codary-sub-full.svg"
          alt="Codary Sub Logo"
          width={180}
          height={45}
          className="w-32 md:w-48 h-auto"
          priority
        />
        <p className="text-[10px] md:text-sm text-gray-500 font-medium ml-1 tracking-wide">จัดการสมาชิกของคุณ</p>
      </div>

      <div className="relative z-20 flex items-center gap-3">
        {userProfile.line_user_id ? (
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-50 border border-green-100 text-[#00C300] text-[10px] font-bold shadow-sm whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C300] animate-pulse"></span>
            LINE เชื่อมแล้ว
          </div>
        ) : (
          <a 
            href={`https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_LINE_LOGIN_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_LINE_LOGIN_REDIRECT_URI}&state=${userProfile.id}&scope=profile%20openid`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00C300] text-white text-[10px] font-bold hover:bg-[#00a300] transition-all shadow-lg shadow-green-100 active:scale-95 whitespace-nowrap"
          >
            เชื่อม LINE
          </a>
        )}

        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center p-1 rounded-full transition-all duration-300 hover:bg-gray-50 border-2 ${isMenuOpen ? 'border-[#00C300] bg-gray-50 shadow-inner scale-105' : 'border-transparent shadow-sm'}`}
          >
            <div className="relative">
              <img 
                src={userProfile.avatar_url || ''} 
                alt="Profile" 
                className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-sm border border-white" 
              />
              {userProfile.role === 'admin' && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#10B981] text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  ⚙️
                </div>
              )}
            </div>
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-1 mt-3 w-56 bg-white/95 backdrop-blur-md rounded-[2rem] shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
              <div className="px-5 py-3 mb-2 border-b border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">คุณกำลังใช้งานเป็น</p>
                <p className="text-sm font-bold text-gray-800 truncate">{userProfile.display_name}</p>
                <p className="text-[10px] text-gray-500 truncate">{userProfile.email}</p>
              </div>

              {userProfile.role === 'admin' && (
                <Link 
                  href="/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-3 text-gray-700 hover:bg-green-50 transition-colors group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-green-100 text-[#00C300] group-hover:bg-[#00C300] group-hover:text-white transition-all">⚙️</span>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold">จัดการหลังบ้าน</span>
                    <span className="text-[10px] text-gray-400">สำหรับแอดมินเท่านั้น</span>
                  </div>
                </Link>
              )}

              <button 
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
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
  );
}