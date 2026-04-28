'use client';

import Image from 'next/image';

interface SplashOverlayProps {
  isVisible: boolean;
  isFadingOut: boolean;
  message?: string;
}

export default function SplashOverlay({ isVisible, isFadingOut, message = "กำลังเตรียมข้อมูลของคุณ..." }: SplashOverlayProps) {
  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-gray-50 overflow-hidden transition-opacity duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* --- ลวดลายพื้นหลัง (Dot Grid Pattern) --- */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
      
      {/* --- แสงออร่าพาสเทล (Blurred Orbs) --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="absolute -top-[10%] -right-[5%] w-96 h-96 bg-[#BCE2E8]/40 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] -left-[10%] w-80 h-80 bg-[#F3CFE0]/40 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-96 h-96 bg-[#CCF0D4]/40 rounded-full blur-3xl"></div>
      </div>

      <div className={`flex flex-col items-center gap-6 ${!isFadingOut ? 'animate-in fade-in zoom-in duration-700' : ''}`}>
        <Image 
          src="/codary-sub-full.svg" 
          alt="Codary Sub Logo" 
          width={240} 
          height={72} 
          priority
          className="w-auto h-16 drop-shadow-md"
        />
        <div className="flex items-center gap-3 text-gray-500 font-medium">
          <svg className="animate-spin h-5 w-5 text-[#BCE2E8]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {message}
        </div>
      </div>
    </div>
  );
}
