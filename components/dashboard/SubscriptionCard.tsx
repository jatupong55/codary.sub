// src/components/dashboard/SubscriptionCard.tsx
'use client';

import { calculateStackedPayment, calculateDaysLeft, formatDate } from '@/utils/dashboardUtils';
import { supabase } from '@/lib/supabase'; // ✨ อย่าลืม import supabase สำหรับปุ่ม Test นะครับ

interface SubscriptionCardProps {
  sub: any;
  onOpenDetail: (sub: any) => void;
  onOpenPayment: (basePrice: number, subId: string) => void;
}

// -------------------------------------------------------------------
// ฟังก์ชันสำหรับดึง Logo และ สีพื้นหลังของแต่ละแบรนด์
// -------------------------------------------------------------------
const getBrandStyle = (category: string) => {
  // ดักจับปัญหาตัวพิมพ์เล็ก/ใหญ่ และตัดช่องว่าง
  const safeCategory = category?.toLowerCase()?.trim() || '';

  const styles: Record<string, { bg: string, logo: string }> = {
    spotify: { bg: 'bg-[#191414]', logo: 'https://cdn.simpleicons.org/spotify/1DB954' },
    netflix: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/netflix/E50914' },
    youtube: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/youtube/FF0000' },
    
    // โลโก้ตัวอักษรสีน้ำเงินเข้ม -> ใช้พื้นขาว
    disney: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
    
    hbo: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/hbo/ffffff' },
    
    // โลโก้สีเหลือง -> ใช้พื้นดำ
    viu: { bg: 'bg-[#121212]', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Viu_logo.svg' },
    
    // โลโก้ตัวอักษรไล่สี -> ใช้พื้นขาว
    canva: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Canva_logo.svg' },
    
    google_one: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/google/4285F4' },
    apple_one: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/apple/ffffff' },
    
    // โลโก้สีแดง -> ใช้พื้นขาว
    nintendo: { bg: 'bg-white border border-gray-100', logo: 'https://www.nintendo.co.jp/common/v2/img/ncommon/_common/logo/switch.svg' },
    
    ms365: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/microsoft365/D83B01' },
  };

  return styles[safeCategory] || { bg: 'bg-gray-100', logo: '' };
};

export default function SubscriptionCard({ sub, onOpenDetail, onOpenPayment }: SubscriptionCardProps) {
  const daysLeft = calculateDaysLeft(sub.end_date);
  const isExpiringSoon = daysLeft <= 3;
  const product = sub.products;
  const details = sub.details || {};

  const isSpotify = product.category === 'spotify';
  const iconBg = isSpotify ? 'bg-[#2D2D2D]' : 'bg-blue-600';
  const iconText = isSpotify ? 'text-[#1DB954]' : 'text-white';
  const iconLabel = isSpotify ? 'SP' : 'M';
  const codaryPastelGradient = 'from-[#BCE2E8] via-[#F3CFE0] to-[#CCF0D4]';

  const basePrice = details.retailPrice || product.price;
  const stackedPayment = calculateStackedPayment(sub.end_date, basePrice, product.category);

  // เช็กว่ามี Payment ไหนที่ยัง "รอตรวจสอบ" อยู่ไหม
  const hasPendingPayment = sub.payments?.some((p: any) => p.status === 'รอตรวจสอบ');

  // -------------------------------------------------------------------
  // Action สำหรับ Test (โชว์เฉพาะเปิด .env ไว้)
  // -------------------------------------------------------------------
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === 'true';
  const brandStyle = getBrandStyle(product.category);

  const handleForceExpire = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { error } = await supabase
      .from('subscriptions')
      .update({ end_date: yesterday.toISOString() })
      .eq('id', sub.id);

    if (error) {
      alert('ปรับวันหมดอายุล้มเหลว: ' + error.message);
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      onClick={() => { 
        if (!isExpiringSoon && !hasPendingPayment) onOpenDetail(sub); 
      }}
      className={`group relative p-[1.5px] rounded-[2rem] overflow-hidden transition-all duration-300 shadow-sm
        ${hasPendingPayment ? 'opacity-80 cursor-default' : 'hover:scale-[0.99] active:scale-[0.97] bg-gray-100/50 cursor-pointer active:shadow-inner select-none touch-manipulation'}
      `}
    >
      {!hasPendingPayment && (
        <div className={`absolute inset-0 bg-gradient-to-br ${codaryPastelGradient} opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300`}></div>
      )}

      <div className={`relative bg-white h-full w-full rounded-[calc(2rem-1.5px)] p-6 flex flex-col gap-5 transition-colors duration-300 ${!hasPendingPayment ? 'group-active:bg-gray-50/95' : ''}`}>
        
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-sm transition-all duration-300 ${brandStyle.bg} ${!hasPendingPayment ? 'group-hover:-rotate-3 group-active:scale-95 group-active:-rotate-6' : ''}`}>
              {brandStyle.logo ? (
                <img src={brandStyle.logo} alt={product.category} className="w-6 h-6 object-contain drop-shadow-sm" />
              ) : (
                <span className="text-gray-400 font-black text-lg">{product.category.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h4 className="font-bold text-[#2D2D2D] text-base transition-colors duration-300">{product.name}</h4>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{sub.master_account || 'Personal License'}</p>
            </div>
          </div>
          
          {hasPendingPayment ? (
            <span className="text-yellow-700 bg-yellow-100 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider">Pending</span>
          ) : isExpiringSoon ? (
            <span className="text-[#E57373] bg-[#FFEBEE] text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider group-active:scale-95 transition-transform duration-300">Expiring Soon</span>
          ) : (
            <span className="text-[#347144] bg-[#CCF0D4]/60 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider group-active:scale-95 transition-transform duration-300">Active</span>
          )}
        </div>

        <div className="flex justify-between items-end mt-1">
          <div className="flex flex-col transition-opacity duration-300">
            {isExpiringSoon && !hasPendingPayment ? (
              <p className="text-[11px] text-[#E57373] font-bold mb-1 tracking-wide">เหลืออีก {daysLeft} วัน</p>
            ) : (
              <p className="text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-widest">หมดอายุ</p>
            )}
            <p className={`text-sm font-semibold ${hasPendingPayment ? 'text-gray-400' : 'text-[#2D2D2D]'}`}>{formatDate(sub.end_date)}</p>
          </div>

          {/* ส่วนของกลุ่มปุ่มด้านขวาล่าง */}
          <div className="flex items-center gap-2 z-10">
            
            {/* โชว์ปุ่มเทสต์เฉพาะตอนเปิด Test Mode และไม่ได้รอตรวจสอบ/ใกล้หมดอายุ */}
            {isTestMode && !isExpiringSoon && !hasPendingPayment && (
              <button
                onClick={handleForceExpire}
                className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2.5 py-2 rounded-xl hover:bg-orange-200 transition-colors active:scale-95"
              >
                🧪 เทสต์หมดอายุ
              </button>
            )}

            {hasPendingPayment ? (
              <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 py-2 px-3 rounded-lg text-xs font-semibold border border-yellow-100">
                <svg className="w-4 h-4 animate-spin text-yellow-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                รอตรวจสอบ
              </div>
            ) : isExpiringSoon ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPayment(stackedPayment.amount, sub.id);
                }}
                className={`flex items-center gap-1.5 text-sm font-bold py-2.5 px-5 rounded-xl border border-white/60 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 ${stackedPayment.months > 1 ? 'bg-red-50 text-red-600' : 'bg-gradient-to-br from-[#CCF0D4] to-[#BCE2E8] text-[#2D2D2D]'}`}
              >
                ต่ออายุ {stackedPayment.amount} ฿ 
                {stackedPayment.months > 1 && <span className="text-[10px] ml-1 bg-red-100 px-1.5 py-0.5 rounded">x{stackedPayment.months}</span>}
              </button>
            ) : (
              <div className="flex items-center gap-1 text-gray-400 text-sm font-semibold py-2 px-1 transition-all duration-300 group-hover:text-[#2D2D2D] group-hover:translate-x-1 pointer-events-none">
                รายละเอียด <span className="text-lg">→</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}