'use client';

import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function Home() {
  
  // ฟังก์ชันกดปุ่ม Login เปลี่ยนเป็น Google
  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // ใช้ window.location.origin ถูกต้องแล้วครับ มันจะดึง URL ปัจจุบัน (ngrok) มาให้เอง
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('Supabase Error:', error.message);
        alert(`เกิดข้อผิดพลาดจาก Supabase: ${error.message}`);
      }
    } catch (err: any) {
      console.error('System Error:', err);
      alert(`ระบบขัดข้อง: ${err.message}`);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 overflow-hidden">
      
      {/* --- ลวดลายพื้นหลัง (Dot Grid Pattern) แบบเดียวกับ Dashboard --- */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
      
      {/* --- แสงออร่าพาสเทล (Blurred Orbs) ตกแต่งฉากหลัง --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="absolute -top-[10%] -right-[5%] w-96 h-96 bg-[#BCE2E8]/40 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] -left-[10%] w-80 h-80 bg-[#F3CFE0]/40 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-96 h-96 bg-[#CCF0D4]/40 rounded-full blur-3xl"></div>
      </div>

      {/* --- กล่อง Login หลัก (Glassmorphism & Premium Box) --- */}
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white p-10 text-center animate-in fade-in zoom-in-95 duration-700 ease-out overflow-hidden">
        
        {/* แถบสีพาสเทล (Codary Brand Gradient) ด้านบนของกล่อง */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#BCE2E8] via-[#F3CFE0] to-[#CCF0D4]"></div>

        <div className="flex flex-col items-center mb-10 mt-2">
          {/* ใช้ Official SVG Logo แทนตัวอักษร */}
          <Image 
            src="/codary-sub-full.svg" 
            alt="Codary Sub Logo" 
            width={200} 
            height={60} 
            priority
            className="w-auto h-14 drop-shadow-sm mb-4"
          />
          <p className="text-gray-400 font-medium text-sm tracking-wide">แพลตฟอร์มจัดการสตรีมมิ่งที่ง่ายที่สุด</p>
        </div>
        
        {/* --- ปุ่ม Google Login (Fluid & Premium Interactive) --- */}
        <button 
          onClick={handleGoogleLogin}
          className="group relative w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:border-[#BCE2E8] text-[#2D2D2D] font-bold py-4 px-4 rounded-2xl transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md overflow-hidden"
        >
          {/* เอฟเฟกต์แสงวิ่งพาดผ่านตอน Hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#BCE2E8]/0 via-[#BCE2E8]/15 to-[#BCE2E8]/0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center justify-center bg-gray-50 p-1.5 rounded-full group-hover:bg-white transition-colors duration-300 shadow-sm border border-gray-100">
            {/* โลโก้ Google SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <span className="relative z-10 tracking-wide">เข้าสู่ระบบด้วย Google</span>
        </button>

        {/* --- ส่วนรับประกันความปลอดภัย (Trust Indicator) --- */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-4 h-4 bg-[#CCF0D4] rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-[#347144]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[11px] text-gray-400 font-medium">ปลอดภัยและเป็นส่วนตัว 100%</p>
        </div>

      </div>
    </main>
  );
}