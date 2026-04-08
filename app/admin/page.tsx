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
          .select('id, amount, status, created_at, users(display_name), subscriptions(products(name))')
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
        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#BCE2E8]/40 rounded-full blur-2xl" />
          <h3 className="text-gray-500 font-medium">ลูกค้าทั้งหมด</h3>
          <p className="text-4xl font-bold text-gray-800 mt-2">{stats.totalUsers} <span className="text-lg font-normal text-gray-500">คน</span></p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#CCF0D4]/40 rounded-full blur-2xl" />
          <h3 className="text-gray-500 font-medium">แพ็กเกจที่ใช้งานอยู่ (Active)</h3>
          <p className="text-4xl font-bold text-gray-800 mt-2">{stats.activeSubs} <span className="text-lg font-normal text-gray-500">รายการ</span></p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#F3CFE0]/40 rounded-full blur-2xl" />
          <h3 className="text-gray-500 font-medium">รายได้เดือนปัจจุบัน</h3>
          <p className="text-4xl font-bold text-gray-800 mt-2">฿{stats.totalRevenue.toLocaleString()}</p>
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