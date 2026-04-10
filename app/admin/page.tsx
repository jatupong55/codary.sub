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
    recentPayments: [] as any[]
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

      const [
        { count: totalUsers },
        { count: activeSubs },
        { data: monthlyRevenue },
        { data: recentPayments }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payments').select('amount').eq('status', 'สำเร็จ').gte('created_at', startOfMonth),
        
        supabase.from('payments')
          .select(`
            id, amount, status, created_at, 
            users ( display_name ), 
            subscriptions!payments_subscription_id_fkey ( 
              products!subscriptions_product_id_fkey ( name ) 
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const totalRevenue = monthlyRevenue?.reduce((sum, payment) => sum + (payment?.amount || 0), 0) || 0;

      setStats({
        totalUsers: totalUsers || 0,
        activeSubs: activeSubs || 0,
        totalRevenue,
        recentPayments: recentPayments || []
      });

      setIsLoading(false);
    };

    checkAuthAndFetchData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#BCE2E8] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">กำลังโหลดข้อมูลภาพรวม...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">ภาพรวมระบบ</h1>
        <p className="text-gray-500 mt-2">สรุปข้อมูลการดำเนินงานทั้งหมด</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: ลูกค้าทั้งหมด (ธีมสีฟ้า เร่งความเข้ม) */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7DC9D9] to-[#BCE2E8] border border-[#7DC9D9]/50 shadow-lg shadow-[#BCE2E8]/40 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-gray-800 font-bold mb-1 opacity-80">ลูกค้าทั้งหมด</h3>
              <p className="text-4xl font-black text-gray-900 mt-1 drop-shadow-sm">
                {stats.totalUsers} <span className="text-lg font-bold opacity-70">คน</span>
              </p>
            </div>
            <div className="p-3 bg-white/40 backdrop-blur-md rounded-xl text-gray-900 shadow-sm border border-white/50">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: แพ็กเกจที่ใช้งานอยู่ (ธีมสีเขียว เร่งความเข้ม) */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#8FE3A9] to-[#CCF0D4] border border-[#8FE3A9]/50 shadow-lg shadow-[#CCF0D4]/40 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-gray-800 font-bold mb-1 opacity-80">แพ็กเกจที่ใช้งานอยู่ (Active)</h3>
              <p className="text-4xl font-black text-gray-900 mt-1 drop-shadow-sm">
                {stats.activeSubs} <span className="text-lg font-bold opacity-70">รายการ</span>
              </p>
            </div>
            <div className="p-3 bg-white/40 backdrop-blur-md rounded-xl text-gray-900 shadow-sm border border-white/50">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: รายได้เดือนปัจจุบัน (ธีมสีชมพู เร่งความเข้ม) */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#E6A1C3] to-[#F3CFE0] border border-[#E6A1C3]/50 shadow-lg shadow-[#F3CFE0]/40 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-colors" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-gray-800 font-bold mb-1 opacity-80">รายได้เดือนปัจจุบัน</h3>
              <p className="text-4xl font-black text-gray-900 mt-1 drop-shadow-sm">
                ฿{stats.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white/40 backdrop-blur-md rounded-xl text-gray-900 shadow-sm border border-white/50">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Payments */}
      <div className="bg-white/70 backdrop-blur-lg border border-white/50 rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">การชำระเงินล่าสุด</h2>
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
                  <td className="py-4 text-gray-800">฿{payment?.amount?.toLocaleString()}</td>
                  <td className="py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      payment.status === 'สำเร็จ' ? 'bg-[#CCF0D4] text-green-800' :
                      payment.status === 'รอตรวจสอบ' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="py-4 text-gray-500">
                    {new Date(payment.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
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