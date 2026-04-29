// src/components/dashboard/Header.tsx
'use client';

import Image from 'next/image';
import type { UserProfile } from '@/types/dashboard';

interface HeaderProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export default function Header({ userProfile, onLogout }: HeaderProps) {
  if (!userProfile) return null;

  return (
    <header className="relative overflow-hidden bg-white rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between mb-8 p-6 transition-all duration-300 hover:shadow-md">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
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

      <div className="relative z-10 flex flex-col items-end gap-2.5">
        <div className="flex items-center gap-3">
          {userProfile.line_user_id ? (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-50 border border-green-100 text-[#00C300] text-[10px] font-bold shadow-sm whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C300] animate-pulse"></span>
              LINE เชื่อมแล้ว
            </div>
          ) : (
            <a 
              href={`https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_LINE_LOGIN_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_LINE_LOGIN_REDIRECT_URI}&state=${userProfile.id}&scope=profile%20openid`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00C300] text-white text-[10px] font-bold hover:bg-[#00a300] transition-all shadow-lg shadow-green-100 hover:shadow-green-200 active:scale-95 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M22.25 10.5c0-4.694-4.597-8.5-10.25-8.5S1.75 5.806 1.75 10.5c0 4.204 3.655 7.714 8.59 8.368.334.072.787.221.9.507.103.259.068.665-.033 1.102l-.15 1.055c-.045.311-.219 1.216.945.663 1.164-.553 6.284-3.702 8.567-6.335 1.564-1.803 1.681-3.321 1.681-4.358z"/></svg>
              เชื่อม LINE
            </a>
          )}
          <div className="p-1 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-100">
            <img src={userProfile.avatar_url || ''} alt="Profile" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover transition-transform duration-300 hover:scale-105" />
          </div>
        </div>
        <button onClick={onLogout} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50/80 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all duration-300 active:scale-95">
          <span className="text-[11px] font-semibold text-gray-500 group-hover:text-red-600 transition-colors duration-300">ออกจากระบบ</span>
          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transform group-hover:translate-x-0.5 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}