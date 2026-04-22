// components/admin/AdminSummaryCards.tsx
'use client';

import { formatCurrency } from '@/utils/subscriptionUtils';

interface AdminSummaryCardsProps {
  stats: {
    pendingCount: number;
    activeSubs: number;
    availableSlots: number;
    totalRevenue: number;
    totalCost: number;
    netProfit: number;
  };
}

export default function AdminSummaryCards({ stats }: AdminSummaryCardsProps) {
  return (
    <div className="space-y-6">
      {/* === Summary Cards (ปรับเป็น 4 คอลัมน์) === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: รอตรวจสอบสลิป (สำคัญสุด ไว้ซ้ายสุด) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-400 to-red-400 border border-orange-300 shadow-lg shadow-orange-200/50 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 text-white">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:bg-white/30 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="font-bold mb-1 opacity-90 flex items-center gap-1.5">
                <span className="relative flex h-3 w-3">
                  {stats.pendingCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>}
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                รอตรวจสอบสลิป
              </h3>
              <p className="text-4xl font-black mt-1 drop-shadow-sm">
                {stats.pendingCount} <span className="text-lg font-bold opacity-80">รายการ</span>
              </p>
            </div>
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white shadow-sm border border-white/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
          </div>
        </div>

        {/* Card 2: แพ็กเกจที่ใช้งานอยู่ */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#8FE3A9] to-[#CCF0D4] border border-[#8FE3A9]/50 shadow-lg shadow-[#CCF0D4]/40 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-gray-800 font-bold mb-1 opacity-80">แพ็กเกจใช้งาน (Active)</h3>
              <p className="text-4xl font-black text-gray-900 mt-1 drop-shadow-sm">
                {stats.activeSubs} <span className="text-lg font-bold opacity-70">รายการ</span>
              </p>
            </div>
            <div className="p-2.5 bg-white/40 backdrop-blur-md rounded-xl text-green-800 shadow-sm border border-white/50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
          </div>
        </div>

        {/* Card 3: โควตาบ้านว่าง */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-300 to-cyan-200 border border-blue-300/50 shadow-lg shadow-blue-200/40 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-gray-800 font-bold mb-1 opacity-80">โควตาบ้านที่ยังว่าง</h3>
              <p className="text-4xl font-black text-blue-900 mt-1 drop-shadow-sm">
                {stats.availableSlots} <span className="text-lg font-bold opacity-70">ที่นั่ง</span>
              </p>
            </div>
            <div className="p-2.5 bg-white/40 backdrop-blur-md rounded-xl text-blue-800 shadow-sm border border-white/50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
          </div>
        </div>

        {/* Card 4: รายได้เดือนปัจจุบัน */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#E6A1C3] to-[#F3CFE0] border border-[#E6A1C3]/50 shadow-lg shadow-[#F3CFE0]/40 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-gray-800 font-bold mb-1 opacity-80">รายได้เดือนปัจจุบัน</h3>
              <p className="text-4xl font-black text-gray-900 mt-1 drop-shadow-sm truncate">
                <span className="text-xl mr-1 opacity-80">฿</span>
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="p-2.5 bg-white/40 backdrop-blur-md rounded-xl text-pink-800 shadow-sm border border-white/50 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* === Financial Summary Bar === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* รายได้ */}
        <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">รายรับเดือนนี้</p>
          <p className="text-2xl font-black text-gray-800">฿{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">จากสลิปที่อนุมัติแล้ว</p>
        </div>

        {/* ต้นทุน */}
        <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ต้นทุนรวม (บ้านทั้งหมด)</p>
          <p className="text-2xl font-black text-red-500">฿{formatCurrency(stats.totalCost)}</p>
          <p className="text-xs text-gray-400 mt-1">cost รวมทุก master account</p>
        </div>

        {/* กำไรสุทธิ */}
        <div className={`backdrop-blur-lg border rounded-2xl shadow-sm p-5 ${stats.netProfit >= 0
            ? 'bg-gradient-to-br from-[#8FE3A9]/30 to-[#CCF0D4]/30 border-green-200'
            : 'bg-gradient-to-br from-red-100/50 to-red-50/50 border-red-200'
          }`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">กำไรสุทธิเดือนนี้</p>
          <p className={`text-2xl font-black ${stats.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {stats.netProfit < 0 ? '-' : ''}฿{formatCurrency(Math.abs(stats.netProfit))}
          </p>
          <p className="text-xs text-gray-400 mt-1">รายรับ − ต้นทุน</p>
        </div>
      </div>
    </div>
  );
}
