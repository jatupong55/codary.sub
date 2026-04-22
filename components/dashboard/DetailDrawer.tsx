// src/components/dashboard/DetailDrawer.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateStackedPayment } from '@/utils/subscriptionUtils';
import type { DashboardSubscription, UserProfile, Payment } from '@/types/dashboard';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sub: DashboardSubscription;
  userProfile: UserProfile;
}

const getBrandStyle = (category: string) => {
  const safeCategory = category?.toLowerCase()?.trim() || '';
  const styles: Record<string, { bg: string, logo: string }> = {
    spotify: { bg: 'bg-[#191414]', logo: 'https://cdn.simpleicons.org/spotify/1DB954' },
    netflix: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/netflix/E50914' },
    youtube: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/youtube/FF0000' },
    disney: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
    hbo: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/hbo/ffffff' },
    viu: { bg: 'bg-[#121212]', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Viu_logo.svg' },
    canva: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Canva_logo.svg' },
    google: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/google/4285F4' },
    apple: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/apple/ffffff' },
    nintendo: { bg: 'bg-white border border-gray-100', logo: 'https://www.nintendo.co.jp/common/v2/img/ncommon/_common/logo/switch.svg' },
    ms365: { bg: 'bg-white border border-gray-100', logo: 'https://files.brandlogos.net/svg/RwAX3bZKbl/microsoft-365-copilot-logo-brandlogos.net_78lfgdevk.svg' },
  };
  return styles[safeCategory] || { bg: 'bg-gray-50 border border-gray-200', logo: '' };
};

export default function DetailDrawer({ isOpen, onClose, sub, userProfile }: DetailDrawerProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [activeSub, setActiveSub] = useState(sub);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });
  const [selectedSlip, setSelectedSlip] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sub) {
      setActiveSub(sub);
      setShouldRender(true);
      const timer = setTimeout(() => setShowAnimation(true), 50);
      
      const fetchPaymentHistory = async () => {
        setIsLoadingPayments(true);
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('subscription_id', sub.id)
          .order('created_at', { ascending: false });
          
        if (error) console.error("ดึงข้อมูลประวัติการชำระเงินล้มเหลว:", error.message);
        if (data) setPayments(data);
        setIsLoadingPayments(false);
      };
      
      fetchPaymentHistory();
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
      const timer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, sub]);

  if (!shouldRender || !activeSub) return null;
  const product = Array.isArray(activeSub.products) ? activeSub.products[0] : (activeSub.products || {} as any);
  const details = activeSub.details || {};
  
  // เช็กว่าใช่ Spotify ไหม เพื่อโชว์ข้อมูลลิงก์เข้ากลุ่ม
  const isSpotify = product.category?.toLowerCase().trim() === 'spotify';
  
  // ใช้ end_date เป็น "วันต่ออายุถัดไป"
  const nextDate = activeSub.end_date
    ? new Date(activeSub.end_date).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
    : '-';

  // ราคาที่ถูกต้อง: ดึงจาก expectedPrice ที่บันทึกตอนสั่งซื้อ
  // ถ้าไม่มีค่อย fallback ตาม billing_cycle
  const basePrice = details.expectedPrice || (
    activeSub.billing_cycle === 'yearly'
      ? (product.yearly_price || product.price * 12)
      : product.price
  );
  const stackedPayment = calculateStackedPayment(activeSub.end_date, basePrice, product.category);

  // จัดการการแสดงผล Logo และสีพื้นหลัง
  const brandStyle = getBrandStyle(product.category);
  const iconSource = product.icon || brandStyle.logo;
  const isUrl = iconSource?.startsWith('http') || iconSource?.startsWith('data:image');
  
  const useDatabaseColor = product.bg_color && product.bg_color !== '#f3f4f6';
  const containerStyle = useDatabaseColor ? { backgroundColor: product.bg_color } : {};
  const fallbackClass = useDatabaseColor ? '' : brandStyle.bg;

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) {
      showToast(`ไม่มีข้อมูล${label}ให้คัดลอก`);
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`คัดลอก ${label} เรียบร้อยแล้ว`);
  };

  return (
    <div className={`fixed inset-0 z-[70] flex items-end md:items-stretch md:justify-end ${showAnimation ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${showAnimation ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`relative bg-white w-full md:w-[480px] h-[90vh] md:h-screen rounded-t-[2.5rem] md:rounded-t-none md:rounded-l-[3rem] shadow-2xl overflow-hidden flex flex-col transform transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${showAnimation ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-[100%]'}`}>
        
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#BCE2E8]/20 via-[#F3CFE0]/20 to-[#CCF0D4]/20 blur-3xl pointer-events-none"></div>

        <div className="p-8 h-full overflow-y-auto space-y-10 scrollbar-hide relative z-0">
          <div className="flex justify-between items-start relative z-10">
            <div className="flex gap-5 items-start">
              
              {/* กล่องแสดงผล Logo ที่อัปเดตใหม่ */}
              <div 
                className={`w-14 h-14 shrink-0 rounded-[1.2rem] flex items-center justify-center shadow-sm overflow-hidden ${fallbackClass}`}
                style={containerStyle}
              >
                {isUrl ? (
                  <img src={iconSource} alt={product.category} className="w-8 h-8 object-contain" />
                ) : iconSource ? (
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconSource} />
                  </svg>
                ) : (
                  <span className="text-gray-400 font-black text-xl">{product.category?.substring(0, 2).toUpperCase()}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md mb-2 inline-block bg-gray-100 text-gray-500">
                  {product.category || 'PREMIUM'}
                </span>
                <h2 className="text-3xl font-black text-[#2D2D2D] leading-tight">{product.name}</h2>
                <p className="text-sm font-medium text-gray-400 mt-1">
                  แพ็กเกจ{activeSub.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-full transition-colors z-10 shrink-0">✕</button>
          </div>

          <div className="space-y-8 flex-1 relative z-10">
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">ข้อมูลบัญชีและการเข้าใช้</h3>
              <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 space-y-5">
                {isSpotify ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">ที่อยู่ครอบครัว (สำหรับยืนยันตัวตน)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white p-3 rounded-xl border border-gray-100 text-sm font-medium text-gray-700 leading-relaxed">
                          {details.address || 'รอข้อมูลจาก Admin'}
                        </div>
                        <button onClick={() => handleCopy(details.address || '', 'ที่อยู่')} className="bg-white p-3 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors text-gray-500 group flex items-center justify-center">
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
                            <path d="M208 0H332.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128h80v64H64V448H256V416h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    {details.inviteLink && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">ลิงก์เข้าร่วม Family</label>
                        <button 
                          onClick={() => handleCopy(details.inviteLink || '', `ลิงก์คำเชิญ ${product.category || 'Spotify'}`)} 
                          className="w-full bg-[#2D2D2D] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2.5"
                        >
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor">
                            <path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/>
                          </svg>
                          คัดลอกลิงก์เข้ากลุ่ม Spotify
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4"
                      style={{ borderBottom: details.note ? '1px solid #f3f4f6' : 'none' }}>
                      <span className="text-sm font-medium text-gray-500">สถานะสมาชิก</span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#CCF0D4] text-green-800">
                        พร้อมใช้งาน
                      </span>
                    </div>
                    {details.note && (
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">{details.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">รายละเอียดราคา</h3>
              <div className="space-y-2">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">เรียกเก็บเงินรอบถัดไป</span>
                    <span className="text-sm font-bold text-[#2D2D2D]">{nextDate}</span>
                  </div>
                  {details.fullPrice && basePrice && (
                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                      <span className="text-sm font-medium text-gray-500">ราคาเต็มของแพ็กเกจ/รอบ</span>
                      <span className="text-sm font-bold text-gray-400 line-through">฿{details.fullPrice.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className={`flex items-center justify-between p-5 rounded-2xl shadow-sm mt-2 border ${stackedPayment.months > 1 ? 'bg-red-50/50 border-red-200' : 'bg-gradient-to-br from-[#CCF0D4]/40 to-[#BCE2E8]/40 border-[#CCF0D4]/60'}`}>
                  <div>
                    <p className={`text-sm font-extrabold ${stackedPayment.months > 1 ? 'text-red-600' : 'text-[#347144]'}`}>
                      {stackedPayment.months > 1 ? 'ยอดที่ต้องชำระ (รวมค้างชำระ)' : 'ราคาแพ็กเกจของคุณ'}
                    </p>
                    {stackedPayment.months > 1 && (
                      <p className="text-[10px] font-bold text-white bg-red-500 px-2.5 py-0.5 rounded-full inline-block mt-1.5 shadow-sm">
                        ค้างชำระ {stackedPayment.months} เดือน
                      </p>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-bold ${stackedPayment.months > 1 ? 'text-red-600' : 'text-[#347144]'}`}>฿</span>
                    <span className={`text-3xl font-black tracking-tight ${stackedPayment.months > 1 ? 'text-red-600' : 'text-[#347144]'}`}>
                      {stackedPayment.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">ประวัติการชำระเงิน</h3>
              <div className="space-y-3">
                {isLoadingPayments ? (
                  <p className="text-center text-xs text-gray-400 py-4 animate-pulse">กำลังโหลดข้อมูล...</p>
                ) : payments.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-200 rounded-2xl">ยังไม่มีประวัติการชำระเงิน</p>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="group flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-[#CCF0D4] transition-colors cursor-default">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-[#CCF0D4]/20 transition-colors">
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-[#347144]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                            <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V176c0-35.3-28.7-64-64-64H64c-17.7 0-32-14.3-32-32s14.3-32 32-32H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H64zM336 288c0 17.7-14.3 32-32 32s-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#2D2D2D]">฿{Number(payment.amount).toLocaleString()}</p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(payment.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} • {payment.method || 'Thai QR'}
                          </p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeSub.billing_cycle === 'yearly'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                            }`}>
                            {activeSub.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-tight ${payment.status === 'สำเร็จ' ? 'text-[#347144] bg-[#CCF0D4]/40' : 'text-orange-600 bg-orange-100'}`}>
                          {payment.status}
                        </span>
                        {payment.slip_url && (
                          <button 
                            onClick={() => setSelectedSlip(payment.slip_url || null)} 
                            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            ดูสลิป
                            <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5zm8.25-3.75a.75.75 0 01.75.75v2.25h2.25a.75.75 0 010 1.5h-2.25v2.25a.75.75 0 01-1.5 0v-2.25H7.5a.75.75 0 010-1.5h2.25V7.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="pt-4 space-y-3 pb-10">
              <button 
                onClick={() => {
                  const message = `🚨 แจ้งปัญหาการใช้งาน\n\nแพ็กเกจ: ${product.name || 'N/A'}\nบัญชี: ${userProfile?.email || ''}\n\nรายละเอียดปัญหา: `;
                  const encodedText = encodeURIComponent(message);
                  window.open(`https://line.me/R/oaMessage/@367sxicn/?${encodedText}`, '_blank');
                }} 
                className="w-full bg-[#00C300]/10 border border-[#00C300]/20 text-[#00C300] py-3.5 rounded-2xl font-bold text-sm hover:bg-[#00C300]/20 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z" clipRule="evenodd" />
                </svg>
                แจ้งปัญหาการใช้งาน (LINE)
              </button>
              
              <button 
                onClick={() => {
                  if(confirm('คุณต้องการแจ้งยกเลิกแพ็กเกจนี้ใช่หรือไม่? ระบบจะพาคุณไปยัง LINE เพื่อยืนยันกับแอดมิน')) {
                    const message = `💔 แจ้งยกเลิกแพ็กเกจ / ออกจากกลุ่ม\n\nแพ็กเกจ: ${product.name || 'N/A'}\nบัญชี: ${userProfile?.email || ''}\n\nเหตุผลที่ต้องการยกเลิก: `;
                    const encodedText = encodeURIComponent(message);
                    window.open(`https://line.me/R/oaMessage/@367sxicn/?${encodedText}`, '_blank');
                  }
                }}
                className="w-full text-red-400 py-3 rounded-xl font-bold text-xs hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
                แจ้งขอออกจากกลุ่ม / ยกเลิกแพ็กเกจ
              </button>
            </section>
          </div>
        </div>

        <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-[#2D2D2D] text-white px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-all duration-300 z-[90] ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95 pointer-events-none'}`}>
          <div className="bg-[#1DB954] w-5 h-5 rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
              <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
            </svg>
          </div>
          <span className="text-xs font-bold whitespace-nowrap">{toast.message}</span>
        </div>
      </div>

      {selectedSlip && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300" 
            onClick={() => setSelectedSlip(null)} 
          />
          <div className="relative z-10 w-full max-w-[90vw] md:max-w-md flex flex-col items-center animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setSelectedSlip(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-all backdrop-blur-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={selectedSlip} 
              alt="Payment Slip" 
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}