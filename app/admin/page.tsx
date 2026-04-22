// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminSummaryCards from '@/components/admin/AdminSummaryCards';
import ProfitAnalysis from '@/components/admin/ProfitAnalysis';
import { calculateDaysLeft, formatCurrency } from '@/utils/subscriptionUtils';

// Types สำหรับข้อมูลที่ดึงไว้ใน stats
// หมายเหตุ: Supabase join คืน related rows เป็น array เสมอ
interface AdminPaymentRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  users?: { display_name?: string | null; email?: string | null }[] | null;
  subscriptions?: { products?: { name?: string | null }[] | null }[] | null;
}

interface AdminExpiringSubRow {
  id: string;
  end_date: string;
  status: string;
  users?: { display_name?: string | null; email?: string | null }[] | null;
  products?: { name?: string | null }[] | null;
}

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
    recentPayments: [] as AdminPaymentRow[],
    pendingPayments: [],
    expiringSubs: [],
    masterAccountsRaw: [],
    monthlyRevenueRaw: []
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
        supabase.from('payments').select('amount, subscriptions(products(name, category))').eq('status', 'สำเร็จ').gte('created_at', startOfMonth),
        
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
        supabase.from('master_accounts').select('max_slots, cost, products(name, category)').eq('status', 'active'),
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
        expiringSubs: expiringSubsData || [],
        masterAccountsRaw: masterAccounts || [],
        monthlyRevenueRaw: monthlyRevenue || []
      });

      setIsLoading(false);
    };

    checkAuthAndFetchData();
  }, [router]);



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

      {/* === Summary Cards & Financial Summary === */}
      <AdminSummaryCards stats={stats} />

      {/* === Profit Analysis Table === */}
      <ProfitAnalysis payments={stats.monthlyRevenueRaw} masterAccounts={stats.masterAccountsRaw} />

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
                      <p className="text-sm font-bold text-gray-800">{payment.users?.[0]?.display_name}</p>
                      <p className="text-[11px] text-gray-500">{payment.subscriptions?.[0]?.products?.[0]?.name}</p>
                    </div>
                    <div className="text-right">
                      {/* [UPDATE] Format เงิน */}
                      <p className="text-sm font-bold text-orange-600">
                        ฿{formatCurrency(Number(payment.amount))}
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
                  const dLeft = calculateDaysLeft(sub.end_date);
                  return (
                    <li key={sub.id} className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{sub.users?.[0]?.display_name}</p>
                        <p className="text-[11px] text-gray-500">{sub.products?.[0]?.name}</p>
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
                  <td className="py-4 text-gray-800 font-medium">
                    {(() => {
                      const user = Array.isArray(payment?.users) ? payment?.users[0] : payment?.users;
                      return user?.display_name || user?.email || 'ไม่ระบุชื่อ';
                    })()}
                  </td>
                  <td className="py-4 text-gray-600">
                    {(() => {
                      const sub = Array.isArray(payment?.subscriptions) ? payment?.subscriptions[0] : payment?.subscriptions;
                      const product = Array.isArray(sub?.products) ? sub?.products[0] : sub?.products;
                      return product?.name || 'N/A';
                    })()}
                  </td>
                  
                  {/* [UPDATE] Format เงินให้มีลูกน้ำและทศนิยม */}
                  <td className="py-4 text-green-600 font-semibold">
                    ฿{formatCurrency(Number(payment?.amount || 0))}
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