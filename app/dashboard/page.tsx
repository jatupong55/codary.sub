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

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [qrPayload, setQrPayload] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeDetailSub, setActiveDetailSub] = useState<any>(null);

  const MY_PROMPTPAY_ID = "0812345678";

  const fetchSubscriptions = useCallback(async (userId: string) => {
    const { data: subsData, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        start_date,
        end_date,
        status,
        master_account,
        details,
        products!subscriptions_product_id_fkey (
          id,
          name,
          category,
          price
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

      // ---------------------------------------------------------
      // เพิ่ม Logic ตำรวจจราจรตรงนี้: ถ้าเป็น Admin ให้เด้งไปหน้า Admin ทันที
      // ---------------------------------------------------------
      // console.log(dbUser);
      // console.log(dbUser?.role);
      // console.log(dbUser?.role === 'admin');
      if (dbUser?.role === 'admin') {
        router.replace('/admin');
        return; // สั่ง return เพื่อหยุดการทำงานของโค้ดด้านล่างทันที
      }

      setUserProfile({
        id: session.user.id,
        email: session.user.email,
        avatar_url: session.user.user_metadata?.avatar_url || 'https://via.placeholder.com/150',
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

  const handleOpenPayment = (basePrice: number, subId: string) => {
    const randomSatang = Math.floor(Math.random() * 99) + 1;
    const finalPrice = basePrice + (randomSatang / 100);
    setPayAmount(finalPrice);
    setSelectedSubId(subId);

    const payload = generatePayload(MY_PROMPTPAY_ID, { amount: finalPrice });
    setQrPayload(payload);

    setIsModalMounted(true);
    setTimeout(() => setIsModalVisible(true), 10);
  };

  const handleClosePayment = () => {
    setIsModalVisible(false);
    setTimeout(() => setIsModalMounted(false), 300);
  };

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
        
        {/* Component 1: Header */}
        <Header userProfile={userProfile} onLogout={handleLogout} />

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">สวัสดีคุณ, {userProfile.display_name}</h2>
          {userProfile.role === 'admin' && (
            <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-md">Admin</span>
          )}
        </div>

        <section className="space-y-5">
          <div className="flex items-center gap-3 ml-2 mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Plan</h3>
          </div>

          {subscriptions.length === 0 ? (
            <div className="bg-transparent border border-dashed border-gray-300 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center">
              <p className="text-gray-400 text-sm font-medium">ยังไม่มีแพ็กเกจที่ใช้งานในขณะนี้</p>
            </div>
          ) : (
            subscriptions.map((sub) => (
              // Component 2: SubscriptionCard
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
      
      {/* Component 3: DetailDrawer */}
      <DetailDrawer 
        isOpen={isDetailOpen} 
        onClose={handleCloseDetail} 
        sub={activeDetailSub} 
        userProfile={userProfile} 
      />

      {/* Component 4: PaymentModal */}
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