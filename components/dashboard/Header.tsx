// src/components/dashboard/Header.tsx
'use client';

import Image from 'next/image';

interface HeaderProps {
  userProfile: any;
  onLogout: () => void;
}

export default function Header({ userProfile, onLogout }: HeaderProps) {
  if (!userProfile) return null;

  return (
    <header className="relative overflow-hidden bg-white rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between mb-8 p-6 transition-all duration-300 hover:shadow-md">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00C300]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        <Image
          src="/codary-sub-full.svg"
          alt="Codary Sub Logo"
          width={200}
          height={50}
          className="w-40 md:w-48 h-auto"
          priority
        />
        <p className="text-sm text-gray-500 font-medium ml-1 tracking-wide">จัดการแพ็กเกจของคุณ</p>
      </div>

      <div className="relative z-10 flex flex-col items-end gap-2.5">
        <div className="p-1 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-100">
          <img src={userProfile.avatar_url} alt="Profile" className="w-12 h-12 rounded-full object-cover transition-transform duration-300 hover:scale-105" />
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