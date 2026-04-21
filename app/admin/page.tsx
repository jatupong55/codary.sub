// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubs: 0,
    totalRevenue: 0,
    totalCost: 0,
    netProfit: 0,
    pendingCount: 0,
    availableSlots: 0,
    recentPayments: [] as any[],
    pendingPayments: [] as any[],
    expiringSubs: [] as any[]
  });

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }

      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      
      // วันที่สำหรับเช็กคนใกล้หมดอายุ (ภายใน 3 วัน)
      const threeDaysLater = new Date();
      threeDaysLater.setDate(currentDate.getDate() + 3);
      threeDaysLater.setHours(23, 59, 59, 999);

      const [
        { count: totalUsers },
        { count: activeSubs },
        { data: monthlyRevenue },
        { data: recentPayments },
        { data: pendingPaymentsData },
        { data: expiringSubsData },
        { data: masterAccounts },
        { count: filledSlots }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payments').select('amount').eq('status', 'สำเร็จ').gte('created_at', startOfMonth),
        
        // ชำระเงินล่าสุด
        supabase.from('payments')
          .select('id, amount, status, created_at, users(display_name), subscriptions(products(name))')
          .order('created_at', { ascending: false })
          .limit(5),

        // สลิปที่รอตรวจสอบ (ด่วน)
        supabase.from('payments')
          .select('id, amount, status, created_at, users(display_name, email), subscriptions(products(name))')
          .in('status', ['รอตรวจสอบ', 'pending'])
          .order('created_at', { ascending: true }),

        // ลูกค้าที่ใกล้หมดอายุใน 3 วัน (ด่วน)
        supabase.from('subscriptions')
          .select('id, end_date, status, users(display_name, email), products(name)')
          .eq('status', 'active')
          .lte('end_date', threeDaysLater.toISOString())
          .gte('end_date', currentDate.toISOString())
          .order('end_date', { ascending: true }),

        // คำนวณโควตาบ้าน (เอาโควตารวม - คนที่มีบ้านแล้ว)
        supabase.from('master_accounts').select('max_slots, cost').eq('status', 'active'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).not('master_account_id', 'is', null).eq('status', 'active')
      ]);

      const totalRevenue = monthlyRevenue?.reduce((sum, payment) => sum + (payment?.amount || 0), 0) || 0;
      
      const totalCost = masterAccounts?.reduce((sum, acc) => sum + (acc?.cost || 0), 0) || 0;
      const netProfit = totalRevenue - totalCost;
      const totalMaxSlots = masterAccounts?.reduce((sum, account) => sum + (account?.max_slots || 0), 0) || 0;
      const availableSlots = Math.max(0, totalMaxSlots - (filledSlots || 0));

      setStats({
        totalUsers: totalUsers || 0,
        activeSubs: activeSubs || 0,
        totalRevenue,
        totalCost, 
        netProfit, 
        pendingCount: pendingPaymentsData?.length || 0,
        availableSlots,
        recentPayments: recentPayments || [],
        pendingPayments: pendingPaymentsData || [],
        expiringSubs: expiringSubsData || []
      });

      setIsLoading(false);
    };

    checkAuthAndFetchData();
  }, [router]);

  // ฟังก์ชันหาจำนวนวัน
  const getDaysDiff = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#BCE2E8] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">กำลังรวบรวมข้อมูลหลังบ้าน...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
            ภาพรวมระบบ
            {/* [NEW] นำ Total Users ที่ดึงข้อมูลมาแล้ว มาโชว์เป็น Badge น่ารักๆ */}
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
              สมาชิกรวม {stats.totalUsers} คน
            </span>
          </h1>
          <p className="text-gray-500 mt-2">สรุปข้อมูลการดำเนินงาน และสิ่งที่ต้องจัดการวันนี้</p>
        </div>
        <div className="text-right">
            <p className="text-sm font-semibold text-gray-600">ข้อมูล ณ เดือนปัจจุบัน</p>
            <p className="text-xs text-gray-400">{new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

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
                {/* [UPDATE] Format ตัวเลขให้มีลูกน้ำและทศนิยม 2 ตำแหน่ง */}
                {stats.totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <p className="text-2xl font-black text-gray-800">
            ฿{stats.totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">จากสลิปที่อนุมัติแล้ว</p>
        </div>

        {/* ต้นทุน */}
        <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ต้นทุนรวม (บ้านทั้งหมด)</p>
          <p className="text-2xl font-black text-red-500">
            ฿{stats.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">cost รวมทุก master account</p>
        </div>

        {/* กำไรสุทธิ */}
        <div className={`backdrop-blur-lg border rounded-2xl shadow-sm p-5 ${stats.netProfit >= 0
            ? 'bg-gradient-to-br from-[#8FE3A9]/30 to-[#CCF0D4]/30 border-green-200'
            : 'bg-gradient-to-br from-red-100/50 to-red-50/50 border-red-200'
          }`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">กำไรสุทธิเดือนนี้</p>
          <p className={`text-2xl font-black ${stats.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {stats.netProfit < 0 ? '-' : ''}฿{Math.abs(stats.netProfit).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">รายรับ − ต้นทุน</p>
        </div>

      </div>

      {/* === ส่วนแจ้งเตือนด่วน (Needs Attention) 2 คอลัมน์ === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* กล่องซ้าย: รอตรวจสอบสลิป */}
        <div className="bg-white/70 backdrop-blur-lg border border-orange-200 rounded-2xl shadow-sm p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </span>
              สลิปรอตรวจสอบด่วน
            </h2>
            <Link href="/admin/payments" className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">ไปหน้าตรวจสอบสลิป</Link>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {stats.pendingPayments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-6 text-gray-400">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" /></svg>
                <p className="text-sm">ไม่มีสลิปตกค้าง เก่งมากครับ!</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.pendingPayments.map(payment => (
                  <li key={payment.id} className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{payment.users?.display_name}</p>
                      <p className="text-[11px] text-gray-500">{payment.subscriptions?.products?.name}</p>
                    </div>
                    <div className="text-right">
                      {/* [UPDATE] Format เงิน */}
                      <p className="text-sm font-bold text-orange-600">
                        ฿{Number(payment.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-gray-400">{new Date(payment.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* กล่องขวา: กำลังจะหมดอายุ */}
        <div className="bg-white/70 backdrop-blur-lg border border-red-200 rounded-2xl shadow-sm p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
              ใกล้หมดอายุ (ใน 3 วัน)
            </h2>
            <Link href="/admin/customers" className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">ไปหน้าจัดการ</Link>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {stats.expiringSubs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-6 text-gray-400">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm">ไม่มีลูกค้าใกล้หมดอายุเร็วๆ นี้</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.expiringSubs.map(sub => {
                  const dLeft = getDaysDiff(sub.end_date);
                  return (
                    <li key={sub.id} className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{sub.users?.display_name}</p>
                        <p className="text-[11px] text-gray-500">{sub.products?.name}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${dLeft <= 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {dLeft <= 0 ? 'หมดอายุวันนี้' : `เหลือ ${dLeft} วัน`}
                        </span>
                        {/* [UPDATE] แสดงวันที่สไตล์ไทย */}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(sub.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

      </div>

      {/* === Recent Payments === */}
      <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">ประวัติชำระเงินล่าสุด</h2>
          <Link href="/admin/payments" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            ดูทั้งหมด &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-500">
                <th className="pb-3 font-medium">ลูกค้า</th>
                <th className="pb-3 font-medium">บริการ</th>
                <th className="pb-3 font-medium">ยอดเงิน</th>
                <th className="pb-3 font-medium">สถานะ</th>
                <th className="pb-3 font-medium">วันที่</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.recentPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100/50 last:border-0 hover:bg-white/40 transition-colors">
                  <td className="py-4 text-gray-800 font-medium">{payment?.users?.display_name || 'ไม่ระบุชื่อ'}</td>
                  <td className="py-4 text-gray-600">{payment?.subscriptions?.products?.name || 'N/A'}</td>
                  
                  {/* [UPDATE] Format เงินให้มีลูกน้ำและทศนิยม */}
                  <td className="py-4 text-green-600 font-semibold">
                    ฿{Number(payment?.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  
                  <td className="py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      payment.status === 'สำเร็จ' ? 'bg-[#CCF0D4] text-green-800' :
                      payment.status === 'รอตรวจสอบ' || payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="py-4 text-gray-500">
                    {/* [UPDATE] Format วันที่ให้ดูเป็นไทยมากขึ้น */}
                    {new Date(payment.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {stats.recentPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">ยังไม่มีรายการชำระเงิน</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}