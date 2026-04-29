// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import generatePayload from 'promptpay-qr';
import { isSubExpired } from '@/utils/subscriptionUtils';
import type { DashboardSubscription, UserProfile } from '@/types/dashboard';
import { sendLineAdmin } from '@/lib/lineNotify';
import Swal from 'sweetalert2';
import SplashOverlay from '@/components/common/SplashOverlay';

// Import Components ที่เราแยกไว้
import Header from '@/components/dashboard/Header';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';
import DetailDrawer from '@/components/dashboard/DetailDrawer';
import PaymentModal from '@/components/dashboard/PaymentModal';
import StoreDrawer from '@/components/dashboard/StoreDrawer';
import PushNotificationPrompt from '@/components/dashboard/PushNotificationPrompt';

// 1. สร้าง Component หลักแยกออกมา
function DashboardContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscriptions, setSubscriptions] = useState<DashboardSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // เพิ่มตัวเช็ค Mounting
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [qrPayload, setQrPayload] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [isSplashActive, setIsSplashActive] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeDetailSub, setActiveDetailSub] = useState<DashboardSubscription | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // [NEW] เพิ่มตัวแปรเช็คสถานะการ Logout

  const MY_PROMPTPAY_ID = process.env.NEXT_PUBLIC_PROMPTPAY_ID || "";

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
        payments!payments_subscription_id_fkey ( id, status, amount, created_at )
      `)
      .eq('user_id', userId)
      .order('end_date', { ascending: true });

    if (error) console.log('Supabase Error:', error.message);
    if (subsData) setSubscriptions(subsData);
  }, []);

  const handleOpenDetail = (sub: DashboardSubscription) => {
    setActiveDetailSub(sub);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
  };

  useEffect(() => {
    let mounted = true;
    setIsMounted(true); // แจ้งว่า Mount เสร็จแล้วบน Client

    const loadData = async (session: any) => {
      let currentSession = session;

      if (!currentSession) {
        const { data } = await supabase.auth.getSession();
        currentSession = data.session;
      }

      if (!currentSession) {
        // [MOD] ถ้ากำลัง Logout ไม่ต้องดีดกลับอัตโนมัติ (เดี๋ยวฟังก์ชัน handleLogout จัดการเอง)
        if (mounted && !isLoggingOut) router.replace('/');
        return;
      }

      const { data: dbUser } = await supabase
        .from('users')
        .select('*, line_user_id')
        .eq('id', currentSession.user.id)
        .single();

      if (dbUser?.role === 'admin') {
        if (mounted) router.replace('/admin');
        return;
      }

      const fallbackAvatar = process.env.NEXT_PUBLIC_FALLBACK_AVATAR || '';

      if (mounted) {
        setUserProfile({
          id: currentSession.user.id,
          email: currentSession.user.email || '',
          avatar_url: currentSession.user.user_metadata?.avatar_url || fallbackAvatar,
          display_name: dbUser?.display_name || currentSession.user.user_metadata?.name || 'User',
          role: dbUser?.role || 'user',
          line_user_id: dbUser?.line_user_id
        });

        await fetchSubscriptions(currentSession.user.id);
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadData(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, fetchSubscriptions]);

  useEffect(() => {
    if (!isLoading && userProfile && isSplashActive) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsSplashActive(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, userProfile, isSplashActive]);

  const handleLogout = async () => {
    setIsLoggingOut(true); // แจ้งระบบว่ากำลังจะ Logout

    Swal.fire({
      title: 'กำลังออกจากระบบ...',
      html: 'ขอบคุณที่ใช้บริการ Codary Sub ครับ!<br>แล้วพบกันใหม่นะ 😊',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
      customClass: {
        popup: 'rounded-[2rem] p-10 border border-gray-100 shadow-2xl',
      }
    });

    // หน่วงเวลา 2 วินาที (เพิ่มให้นิดนึงเพื่อให้รู้สึกถึงความนุ่มนวล)
    await new Promise(resolve => setTimeout(resolve, 2000));

    await supabase.auth.signOut();
    Swal.close();
    router.replace('/');
  };

  const handleOpenPayment = (sub: DashboardSubscription) => {
    const basePrice = sub.details?.expectedPrice || sub.products?.[0]?.price || 0;
    const finalPrice = basePrice;

    setPayAmount(finalPrice);
    setSelectedSubId(sub.id);

    if (!MY_PROMPTPAY_ID) {
      Swal.fire({
        icon: 'error',
        title: 'ระบบยังไม่พร้อมรับชำระเงิน',
        text: 'ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาแจ้งแอดมิน',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });

      sendLineAdmin(`⚠️ ระบบมีปัญหา: ลูกค้า ${userProfile?.display_name || 'ไม่ระบุชื่อ'} พยายามชำระเงิน แต่คุณยังไม่ได้ตั้งค่า NEXT_PUBLIC_PROMPTPAY_ID ในไฟล์ .env.local ครับ`);
      return;
    }

    const payload = generatePayload(MY_PROMPTPAY_ID, { amount: finalPrice });
    setQrPayload(payload);

    setIsModalMounted(true);
    setTimeout(() => setIsModalVisible(true), 10);
  };

  const handleClosePayment = () => {
    setIsModalVisible(false);
    setTimeout(() => setIsModalMounted(false), 300);
  };

  const currentSubs = subscriptions.filter(sub => sub.status !== 'cancelled' && !isSubExpired(sub));
  const historySubs = subscriptions.filter(sub => sub.status === 'cancelled' || isSubExpired(sub));
  const displaySubs = activeTab === 'current' ? currentSubs : historySubs;

  // ถ้ายังไม่ Mount ให้คืนค่าว่างหรือ Splash แบบนิ่งๆ เพื่อให้ Server กับ Client ตรงกัน
  if (!isMounted) {
    return <main className="min-h-screen bg-gray-50 p-4 pb-20 relative" />;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-20 relative">
      <SplashOverlay
        isVisible={isSplashActive}
        isFadingOut={isFadingOut}
        message="กำลังเตรียม Dashboard ของคุณ..."
      />

      {userProfile && (
        <div className="max-w-md mx-auto mt-6">
          <Header userProfile={userProfile} onLogout={handleLogout} />

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">สวัสดีคุณ, {userProfile.display_name}</h2>
            {userProfile.role === 'admin' && (
              <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-md">Admin</span>
            )}
          </div>

          <PushNotificationPrompt userId={userProfile.id} />

          <div className="flex bg-gray-200/60 p-1 rounded-xl mb-6 shadow-inner">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'current' ? 'bg-white text-gray-800 shadow-sm transform scale-100' : 'text-gray-500 hover:text-gray-700 scale-95'}`}
            >
              แพ็กเกจปัจจุบัน {currentSubs.length > 0 && `(${currentSubs.length})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm transform scale-100' : 'text-gray-500 hover:text-gray-700 scale-95'}`}
            >
              ประวัติ & ยกเลิก {historySubs.length > 0 && `(${historySubs.length})`}
            </button>
          </div>

          <section className="space-y-5">
            <div className="flex items-center justify-between ml-2 mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {activeTab === 'current' ? 'Current Plan' : 'History Plan'}
              </h3>

              {activeTab === 'current' && (
                <StoreDrawer
                  subscriptions={subscriptions}
                  onRefresh={() => fetchSubscriptions(userProfile.id)}
                  onCheckoutSuccess={(price, subId) => {
                    const mockSubData: DashboardSubscription = {
                      id: subId,
                      start_date: new Date().toISOString(),
                      end_date: new Date().toISOString(),
                      status: 'pending',
                      billing_cycle: 'monthly',
                      details: { expectedPrice: price }
                    };
                    handleOpenPayment(mockSubData);
                  }}
                />
              )}
            </div>

            {displaySubs.length === 0 ? (
              <div className="bg-transparent border border-dashed border-gray-300 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center">
                <p className="text-gray-400 text-sm font-medium">
                  {activeTab === 'current' ? 'ยังไม่มีแพ็กเกจที่ใช้งานในขณะนี้' : 'ยังไม่มีประวัติการใช้งานหรือยกเลิกแพ็กเกจ'}
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

          {activeDetailSub && (
            <DetailDrawer
              isOpen={isDetailOpen}
              onClose={handleCloseDetail}
              sub={activeDetailSub}
              userProfile={userProfile}
            />
          )}

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
        </div>
      )}
    </main>
  );
}

// 2. Export แบบปิด SSR เพื่อแก้ปัญหา Hydration Mismatch จาก Cache อย่างถาวร
export default dynamic(() => Promise.resolve(DashboardContent), {
  ssr: false
});