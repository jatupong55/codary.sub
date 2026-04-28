// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import generatePayload from 'promptpay-qr';
import { isSubExpired } from '@/utils/subscriptionUtils';
import type { DashboardSubscription, UserProfile } from '@/types/dashboard';
import { sendLineAdmin } from '@/lib/lineNotify';
import Swal from 'sweetalert2';

// Import Components ที่เราแยกไว้
import Header from '@/components/dashboard/Header';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';
import DetailDrawer from '@/components/dashboard/DetailDrawer';
import PaymentModal from '@/components/dashboard/PaymentModal';
import StoreDrawer from '@/components/dashboard/StoreDrawer';
import PushNotificationPrompt from '@/components/dashboard/PushNotificationPrompt';

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscriptions, setSubscriptions] = useState<DashboardSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [qrPayload, setQrPayload] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeDetailSub, setActiveDetailSub] = useState<DashboardSubscription | null>(null);

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

    const loadData = async (session: any) => {
      let currentSession = session;

      // ถ้า session เป็น null ให้ลองเช็คซ้ำอีกรอบเผื่อเป็นกรณี Race Condition ตอนโหลดหน้า
      if (!currentSession) {
        const { data } = await supabase.auth.getSession();
        currentSession = data.session;
      }

      if (!currentSession) {
        if (mounted) router.replace('/');
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

    // สมัครรับ Event การเปลี่ยนแปลงของ Session ตลอดเวลา (รวมถึงตอนเพิ่งเปิดแอป)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadData(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, fetchSubscriptions]);

  const handleLogout = async () => {
    Swal.fire({
      title: 'กำลังออกจากระบบ...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    await supabase.auth.signOut();
    Swal.close();
    router.push('/');
  };

  // เปลี่ยนจากรับ basePrice เป็นรับ sub (ข้อมูลแพ็กเกจ) ทั้งก้อน
  const handleOpenPayment = (sub: DashboardSubscription) => {
    // 1. ตรวจสอบว่ามี expectedPrice ใน details ไหม ถ้าไม่มีให้กลับไปใช้ราคาตั้งต้นของ product
    const basePrice = sub.details?.expectedPrice || sub.products?.[0]?.price || 0;

    // 2. สุ่มเศษสตางค์ (ตามโค้ดเดิมของคุณลูกค้า)
    // const randomSatang = Math.floor(Math.random() * 99) + 1;
    // const finalPrice = basePrice + (randomSatang / 100);
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
      
      // ส่งแจ้งเตือนหาแอดมินทันที
      sendLineAdmin(`⚠️ ระบบมีปัญหา: ลูกค้า ${userProfile?.display_name || 'ไม่ระบุชื่อ'} พยายามชำระเงิน แต่คุณยังไม่ได้ตั้งค่า NEXT_PUBLIC_PROMPTPAY_ID ในไฟล์ .env.local ครับ`);
      
      return; // หยุดการทำงาน ไม่เปิดหน้า QR Code
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

  // === ฟังก์ชันเช็กว่าหมดอายุแล้วหรือยัง (ให้ตรงกับ Logic ใน Card) ===


  // === กรองข้อมูลแยกตาม Tab ===
  const currentSubs = subscriptions.filter(sub => sub.status !== 'cancelled' && !isSubExpired(sub));
  const historySubs = subscriptions.filter(sub => sub.status === 'cancelled' || isSubExpired(sub));

  const displaySubs = activeTab === 'current' ? currentSubs : historySubs;

  if (isLoading || !userProfile) {
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

        {/* [NEW] แบนเนอร์เปิดแจ้งเตือน Web Push */}
        <PushNotificationPrompt userId={userProfile.id} />

        {/* === ระบบ Tab Navigation === */}
        <div className="flex bg-gray-200/60 p-1 rounded-xl mb-6 shadow-inner">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'current' ? 'bg-white text-gray-800 shadow-sm transform scale-100' : 'text-gray-500 hover:text-gray-700 scale-95'
              }`}
          >
            แพ็กเกจปัจจุบัน {currentSubs.length > 0 && `(${currentSubs.length})`}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm transform scale-100' : 'text-gray-500 hover:text-gray-700 scale-95'
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

    </main>
  );
}