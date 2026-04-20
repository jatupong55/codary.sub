// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import generatePayload from 'promptpay-qr';

// Import Components ที่เราแยกไว้
import Header from '@/components/dashboard/Header';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';
import DetailDrawer from '@/components/dashboard/DetailDrawer';
import PaymentModal from '@/components/dashboard/PaymentModal';
import StoreDrawer from '@/components/dashboard/StoreDrawer';

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // State สำหรับจัดการ Tab (current = ปัจจุบัน, history = ประวัติ/ยกเลิก)
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [qrPayload, setQrPayload] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeDetailSub, setActiveDetailSub] = useState<any>(null);

  const MY_PROMPTPAY_ID = "0873616215";

  const fetchSubscriptions = useCallback(async (userId: string) => {
    const { data: subsData, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        start_date,
        end_date,
        status,
        billing_cycle,
        details,
        products!subscriptions_product_id_fkey (
          id,
          name,
          category,
          price,
          icon,
          bg_color
        ),
        payments!payments_subscription_id_fkey ( id, status )
      `)
      .eq('user_id', userId)
      .order('end_date', { ascending: true });

    if (error) console.log('Supabase Error:', error.message);
    if (subsData) setSubscriptions(subsData);
  }, []);

  const handleOpenDetail = (sub: any) => {
    setActiveDetailSub(sub);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (dbUser?.role === 'admin') {
        router.replace('/admin');
        return; 
      }

      const fallbackAvatar = process.env.NEXT_PUBLIC_FALLBACK_AVATAR || '';

      setUserProfile({
        id: session.user.id,
        email: session.user.email,
        avatar_url: session.user.user_metadata?.avatar_url || fallbackAvatar,
        display_name: dbUser?.display_name || session.user.user_metadata?.name || 'User',
        role: dbUser?.role || 'user'
      });

      await fetchSubscriptions(session.user.id);
      setIsLoading(false);
    };

    fetchInitialData();
  }, [router, fetchSubscriptions]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // เปลี่ยนจากรับ basePrice เป็นรับ sub (ข้อมูลแพ็กเกจ) ทั้งก้อน
  const handleOpenPayment = (sub: any) => {
    // 1. ตรวจสอบว่ามี expectedPrice ใน details ไหม ถ้าไม่มีให้กลับไปใช้ราคาตั้งต้นของ product
    const basePrice = sub.details?.expectedPrice || sub.products?.price || 0;
    
    // 2. สุ่มเศษสตางค์ (ตามโค้ดเดิมของคุณลูกค้า)
    // const randomSatang = Math.floor(Math.random() * 99) + 1;
    // const finalPrice = basePrice + (randomSatang / 100);
    const finalPrice = basePrice;
    
    setPayAmount(finalPrice);
    setSelectedSubId(sub.id);

    const payload = generatePayload(MY_PROMPTPAY_ID, { amount: finalPrice });
    setQrPayload(payload);

    setIsModalMounted(true);
    setTimeout(() => setIsModalVisible(true), 10);
  };

  const handleClosePayment = () => {
    setIsModalVisible(false);
    setTimeout(() => setIsModalMounted(false), 300);
  };

  // === ฟังก์ชันเช็กว่าหมดอายุแล้วหรือยัง (ให้ตรงกับ Logic ใน Card) ===
  const isSubExpired = (sub: any) => {
    const endDate = new Date(sub.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return sub.status === 'expired' || (daysLeft < 0 && sub.status !== 'pending' && sub.status !== 'cancelled');
  };

  // === กรองข้อมูลแยกตาม Tab ===
  const currentSubs = subscriptions.filter(sub => sub.status !== 'cancelled' && !isSubExpired(sub));
  const historySubs = subscriptions.filter(sub => sub.status === 'cancelled' || isSubExpired(sub));

  const displaySubs = activeTab === 'current' ? currentSubs : historySubs;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center transition-opacity duration-500">
          <div className="w-12 h-12 border-4 border-[#00C300] border-t-transparent rounded-full animate-spin mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-20 relative">
      <div className="max-w-md mx-auto mt-6">
        
        <Header userProfile={userProfile} onLogout={handleLogout} />

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">สวัสดีคุณ, {userProfile.display_name}</h2>
          {userProfile.role === 'admin' && (
            <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-md">Admin</span>
          )}
        </div>

        {/* === ระบบ Tab Navigation === */}
        <div className="flex bg-gray-200/60 p-1 rounded-xl mb-6 shadow-inner">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeTab === 'current' ? 'bg-white text-gray-800 shadow-sm transform scale-100' : 'text-gray-500 hover:text-gray-700 scale-95'
            }`}
          >
            แพ็กเกจปัจจุบัน {currentSubs.length > 0 && `(${currentSubs.length})`}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm transform scale-100' : 'text-gray-500 hover:text-gray-700 scale-95'
            }`}
          >
            ประวัติ & ยกเลิก {historySubs.length > 0 && `(${historySubs.length})`}
          </button>
        </div>

        <section className="space-y-5">
          <div className="flex items-center justify-between ml-2 mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {activeTab === 'current' ? 'Current Plan' : 'History Plan'}
            </h3>
            
            {/* แสดงปุ่มสโตร์เฉพาะในหน้าแพ็กเกจปัจจุบัน */}
            {activeTab === 'current' && (
              <StoreDrawer 
                subscriptions={subscriptions}
                onRefresh={() => fetchSubscriptions(userProfile.id)}
                
                // [NEW] โค้ดรับสัญญาณ และสร้าง Mock Data หลอกระบบให้เปิด Modal โอนเงิน
                onCheckoutSuccess={(price, subId) => {
                  const mockSubData = { 
                    id: subId, 
                    details: { expectedPrice: price } 
                  };
                  handleOpenPayment(mockSubData as any);
                }}
              />
            )}
          </div>

          {/* === ส่วนแสดงรายการการ์ด === */}
          {displaySubs.length === 0 ? (
            <div className="bg-transparent border border-dashed border-gray-300 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center">
              <p className="text-gray-400 text-sm font-medium">
                {activeTab === 'current' 
                  ? 'ยังไม่มีแพ็กเกจที่ใช้งานในขณะนี้' 
                  : 'ยังไม่มีประวัติการใช้งานหรือยกเลิกแพ็กเกจ'
                }
              </p>
            </div>
          ) : (
            displaySubs.map((sub) => (
              <SubscriptionCard 
                key={sub.id} 
                sub={sub} 
                onOpenDetail={handleOpenDetail} 
                onOpenPayment={handleOpenPayment} 
              />
            ))
          )}
        </section>
      </div>
      
      <DetailDrawer 
        isOpen={isDetailOpen} 
        onClose={handleCloseDetail} 
        sub={activeDetailSub} 
        userProfile={userProfile} 
      />

      <PaymentModal 
        isMounted={isModalMounted}
        isVisible={isModalVisible}
        onClose={handleClosePayment}
        payAmount={payAmount}
        qrPayload={qrPayload}
        selectedSubId={selectedSubId}
        userProfile={userProfile}
        onSuccess={() => fetchSubscriptions(userProfile.id)}
      />

    </main>
  );
}