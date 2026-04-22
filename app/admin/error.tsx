// app/admin/error.tsx
'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-red-100 m-6">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-gray-800 mb-2">หน้าจัดการระบบมีปัญหา</h2>
      <p className="text-gray-500 mb-8 max-w-sm text-sm">ไม่สามารถดึงข้อมูลแอดมินได้ อาจเกิดจากปัญหาการเชื่อมต่อฐานข้อมูล โปรดลองใหม่อีกครั้ง</p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all"
        >
          ลองใหม่อีกครั้ง
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
        >
          รีโหลดหน้าเว็บ
        </button>
      </div>
    </div>
  );
}
