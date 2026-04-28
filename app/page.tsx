// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true); // กลับมาใช้ true ได้ เพราะเรามี isMounted คุมแล้ว
  const [isMounted, setIsMounted] = useState(false); // เพิ่ม isMounted
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // เช็กว่าตั้งค่า NEXT_PUBLIC_ENABLE_TEST_LOGIN เป็น 'true' ไว้หรือเปล่า
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === 'true';

  useEffect(() => {
    let mounted = true;
    setIsMounted(true);

    // 1. ระบบ Fail-safe: ถ้าผ่านไป 3 วินาทีแล้วยังเช็คไม่เสร็จ ให้ปลด Loading ออก (เผื่อกรณี Error รุนแรง)
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setIsCheckingSession(false);
      }
    }, 3000);

    const checkAuth = async () => {
      try {
        // ดึง Session ปัจจุบัน
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session) {
          window.location.replace('/dashboard');
          return;
        }

        // Fallback: ถ้า getSession เป็น null แต่ตรวจเจอว่ามี Token ค้างอยู่ในเครื่อง
        // ให้ลองใช้ getUser() เพื่อบังคับให้ Supabase ตรวจสอบความถูกต้องของ Token อีกครั้ง (เผื่อกรณี Token หมดอายุแต่ Refresh ได้)
        const hasLocalToken = Object.keys(localStorage).some(key => key.includes('auth-token'));
        if (hasLocalToken) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && mounted) {
            window.location.replace('/dashboard');
            return;
          }
        }

        // หากไม่มีทั้ง Session และ User จริงๆ ถึงจะยอมให้เข้าหน้า Login
        setIsCheckingSession(false);
        clearTimeout(safetyTimer);
      } catch (err) {
        console.error("Auth check error:", err);
        if (mounted) {
          setIsCheckingSession(false);
          clearTimeout(safetyTimer);
        }
      }
    };

    checkAuth();

    // 2. ติดตามเหตุการณ์การล็อกอิน (เช่น SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        window.location.replace('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setIsCheckingSession(false);
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // ฟังก์ชันกดปุ่ม Login ด้วย Google (ของจริง)
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('Supabase Error:', error.message);
        alert(`เกิดข้อผิดพลาดจาก Supabase: ${error.message}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      console.error('System Error:', err);
      alert(`ระบบขัดข้อง: ${message}`);
      setIsGoogleLoading(false);
    }
  };

  // 🚨 ฟังก์ชัน Login สำหรับนักพัฒนา (Test Mode) 🚨
  const handleTestLogin = async (email: string) => {
    setIsTestLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: 'password123', // รหัสผ่านของ User จำลองใน Supabase
      });

      if (error) throw error;
      
      router.push('/dashboard'); // ล็อกอินสำเร็จ เข้าสู่ระบบเลย (จะถูกเตะไปหน้า /admin เองถ้า role เป็น admin)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      alert(`Test Login Error: ${message}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  // --- SPLASH SCREEN (โหลดตอนเช็ค Session เพื่อไม่ให้หน้ากระพริบ) ---
  if (!isMounted || isCheckingSession) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none flex justify-center items-center">
          <div className="absolute -top-[10%] -right-[5%] w-96 h-96 bg-[#BCE2E8]/40 rounded-full blur-3xl"></div>
          <div className="absolute top-[20%] -left-[10%] w-80 h-80 bg-[#F3CFE0]/40 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-[10%] left-[20%] w-96 h-96 bg-[#CCF0D4]/40 rounded-full blur-3xl"></div>
        </div>

        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
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
            กำลังตรวจสอบบัญชีของคุณ...
          </div>
        </div>
      </main>
    );
  }

  // --- LOGIN BOX (โชว์เมื่อแน่ใจแล้วว่าไม่มี Session) ---
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 overflow-hidden">
      
      {/* --- ลวดลายพื้นหลัง (Dot Grid Pattern) --- */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
      
      {/* --- แสงออร่าพาสเทล (Blurred Orbs) --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="absolute -top-[10%] -right-[5%] w-96 h-96 bg-[#BCE2E8]/40 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] -left-[10%] w-80 h-80 bg-[#F3CFE0]/40 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-96 h-96 bg-[#CCF0D4]/40 rounded-full blur-3xl"></div>
      </div>

      {/* --- กล่อง Login หลัก (Glassmorphism & Premium Box) --- */}
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white p-10 text-center animate-in fade-in zoom-in-95 duration-700 ease-out overflow-hidden">
        
        {/* แถบสีพาสเทลด้านบน */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#BCE2E8] via-[#F3CFE0] to-[#CCF0D4]"></div>

        <div className="flex flex-col items-center mb-10 mt-2">
          <Image 
            src="/codary-sub-full.svg" 
            alt="Codary Sub Logo" 
            width={200} 
            height={60} 
            priority
            className="w-auto h-14 drop-shadow-sm mb-4"
          />
          {/* เปลี่ยนคำโปรยเป็นแบบนิ่งๆ เท่ๆ ตามที่ตกลงกันครับ */}
          <p className="text-gray-400 font-medium text-sm tracking-wide">จัดการสมาชิกพรีเมียม... อย่างเป็นระบบ</p>
        </div>
        
        {/* --- ปุ่ม Google Login (Fluid & Premium Interactive) --- */}
        <button 
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="group relative w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:border-[#BCE2E8] text-[#2D2D2D] font-bold py-4 px-4 rounded-2xl transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md overflow-hidden mb-6 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isGoogleLoading ? (
            <div className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="relative z-10 tracking-wide text-gray-500">
                กำลังเข้าสู่ระบบ...
              </span>
            </div>
          ) : (
            <>
              {/* เอฟเฟกต์แสงวิ่งพาดผ่านตอน Hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#BCE2E8]/0 via-[#BCE2E8]/15 to-[#BCE2E8]/0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none"></div>
              
              <div className="relative z-10 flex items-center justify-center bg-gray-50 p-1.5 rounded-full group-hover:bg-white transition-colors duration-300 shadow-sm border border-gray-100">
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <span className="relative z-10 tracking-wide">เข้าสู่ระบบด้วย Google</span>
            </>
          )}
        </button>

        {/* 🚨 ปุ่ม Developer Test Mode จะโชว์เมื่อตั้งค่า .env ไว้เท่านั้น 🚨 */}
        {isTestMode && (
          <div className="mt-6 pt-6 border-t border-dashed border-gray-200">
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">🛠️ Developer Test Mode</p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleTestLogin('admin@test.com')}
                disabled={isTestLoading}
                className="flex-1 bg-gray-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-black transition-colors active:scale-95 disabled:opacity-50"
              >
                Test Admin
              </button>
              <button 
                onClick={() => handleTestLogin('user@test.com')}
                disabled={isTestLoading}
                className="flex-1 bg-blue-50 text-blue-600 text-xs font-bold py-2.5 rounded-xl hover:bg-blue-100 transition-colors active:scale-95 disabled:opacity-50"
              >
                Test User
              </button>
            </div>
          </div>
        )}

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