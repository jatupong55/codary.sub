// src/components/dashboard/SubscriptionCard.tsx
'use client';

import { calculateStackedPayment, calculateDaysLeft, formatDate } from '@/utils/subscriptionUtils';
import { supabase } from '@/lib/supabase';
import type { DashboardSubscription, Payment } from '@/types/dashboard';

interface SubscriptionCardProps {
  sub: DashboardSubscription;
  onOpenDetail: (sub: DashboardSubscription) => void;
  onOpenPayment: (sub: DashboardSubscription) => void;
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
  return styles[safeCategory] || { bg: 'bg-gray-100', logo: '' };
};

export default function SubscriptionCard({ sub, onOpenDetail, onOpenPayment }: SubscriptionCardProps) {
  const daysLeft = calculateDaysLeft(sub.end_date);
  const isExpiringSoon = daysLeft <= 3 && daysLeft >= 0;
  const product = Array.isArray(sub.products) ? sub.products[0] : (sub.products || {} as any);
  const details = sub.details || {};
  const codaryPastelGradient = 'from-[#BCE2E8] via-[#F3CFE0] to-[#CCF0D4]';

  const basePrice = details.retailPrice || product.price;
  const stackedPayment = calculateStackedPayment(sub.end_date, basePrice, product.category);

  // === เงื่อนไขสถานะ (อัปเดตเรื่องปฏิเสธสลิป) ===
  const isCancelled = sub.status === 'cancelled';
  const isExpired = sub.status === 'expired' || (daysLeft < 0 && sub.status !== 'pending' && !isCancelled);
  const isPendingSubscription = sub.status === 'pending';
  
  const pendingPayment = (sub.payments as Payment[] | null)?.find(p => p.status === 'รอตรวจสอบ' || p.status === 'pending');
  const hasPendingPayment = !!pendingPayment;
  
  // เช็กว่ามี Payment ที่ถูกปฏิเสธไหม (และต้องไม่มีที่รอตรวจสอบอยู่ แปลว่าเพิ่งโดนปฏิเสธสดๆ ร้อนๆ)
  const rejectedPayment = (sub.payments as Payment[] | null)?.sort((a, b) => b.id.localeCompare(a.id)).find((p) => p.status === 'ถูกปฏิเสธ' || p.status === 'rejected');
  const isRejectedSlip = !!rejectedPayment && !hasPendingPayment;
  
  // ล็อคการ์ดถ้ายกเลิก, หมดอายุ, หรือรอดำเนินการ
  const isLocked = isPendingSubscription || hasPendingPayment || isCancelled || isExpired;
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === 'true';
  const brandStyle = getBrandStyle(product?.category || '');

  // จัดการการแสดงผล Logo และสีพื้นหลัง
  const iconSource = product?.icon || brandStyle.logo;
  const isUrl = iconSource?.startsWith('http') || iconSource?.startsWith('data:image');
  
  const useDatabaseColor = product?.bg_color && product?.bg_color !== '#f3f4f6';
  const containerStyle = useDatabaseColor ? { backgroundColor: product?.bg_color } : {};
  const fallbackClass = useDatabaseColor ? '' : brandStyle.bg;

  const handleForceExpire = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() + 3);
    const { error } = await supabase.from('subscriptions').update({ end_date: yesterday.toISOString() }).eq('id', sub.id);
    if (error) alert('ปรับวันหมดอายุล้มเหลว: ' + error.message);
    else window.location.reload();
  };

  return (
    <div
      onClick={() => { if (!isExpiringSoon && !isLocked) onOpenDetail(sub); }}
      className={`group relative p-[1.5px] rounded-[2rem] overflow-hidden transition-all duration-300 shadow-sm
        ${isLocked ? 'opacity-90 cursor-not-allowed' : 'hover:scale-[0.99] active:scale-[0.97] bg-gray-100/50 cursor-pointer active:shadow-inner select-none touch-manipulation'}
      `}
    >
      {!isLocked && (
        <div className={`absolute inset-0 bg-gradient-to-br ${codaryPastelGradient} opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300`}></div>
      )}

      <div className={`relative h-full w-full rounded-[calc(2rem-1.5px)] p-6 flex flex-col gap-5 transition-colors duration-300 ${
        isCancelled || isExpired ? 'bg-gray-100 grayscale-[0.5]' :
        isPendingSubscription || hasPendingPayment ? 'bg-gray-50 border border-dashed border-gray-200' : 'bg-white'
      } ${!isLocked ? 'group-active:bg-gray-50/95' : ''}`}>
        
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            
            {/* กล่อง Logo */}
            <div 
              className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-sm transition-all duration-300 ${fallbackClass} ${!isLocked ? 'group-hover:-rotate-3 group-active:scale-95 group-active:-rotate-6' : 'grayscale opacity-60'}`}
              style={containerStyle}
            >
              {isUrl ? (
                <img src={iconSource} alt={product?.category} className="w-6 h-6 object-contain drop-shadow-sm" />
              ) : iconSource ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconSource} />
                </svg>
              ) : (
                <span className="text-gray-400 font-black text-lg">{product?.category?.substring(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 tracking-tight leading-tight group-hover:text-black transition-colors">
                {product?.name || 'กำลังโหลด...'}
              </h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {isCancelled 
                  ? 'แพ็กเกจถูกยกเลิกแล้ว' 
                  : (isLocked && !isRejectedSlip 
                      ? 'รอการจัดสรร' 
                      : sub.billing_cycle === 'yearly' ? 'รอบบิล: รายปี' : 'รอบบิล: รายเดือน'
                    )
                }
              </p>
            </div>
          </div>
          
          {/* === Badge มุมขวาบน === */}
          {isCancelled ? (
            <span className="text-gray-600 bg-gray-200 border border-gray-300 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider">
              ยกเลิกแล้ว
            </span>
          ) : isExpired ? (
            <span className="text-red-700 bg-red-100 border border-red-200 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider">
              หมดอายุ
            </span>
          ) : hasPendingPayment ? (
            <span className="text-yellow-700 bg-yellow-100 border border-yellow-200 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              กำลังตรวจสอบสลิป
            </span>
          ) : isRejectedSlip ? (
            <span className="text-red-600 bg-red-100 border border-red-200 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              สลิปไม่ผ่าน
            </span>
          ) : isPendingSubscription ? (
            <span className="text-orange-600 bg-orange-100 border border-orange-200 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider">
              รอชำระเงิน
            </span>
          ) : isExpiringSoon ? (
            <span className="text-[#E57373] bg-[#FFEBEE] text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider group-active:scale-95 transition-transform duration-300">Expiring Soon</span>
          ) : (
            <span className="text-[#347144] bg-[#CCF0D4]/60 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider group-active:scale-95 transition-transform duration-300">Active</span>
          )}
        </div>

        {/* เริ่ม: แสดงเหตุผลที่ถูกยกเลิก (แอดมินเตะออก) */}
        {isCancelled && details.cancelReason && (
          <div className="w-full mt-1 mb-1 p-3 bg-red-50/80 border border-red-100 rounded-xl">
            <p className="text-[11px] text-red-700 leading-relaxed">
              <span className="font-bold">เหตุผล:</span> {details.cancelReason}
            </p>
          </div>
        )}

        {/* เริ่ม: แสดงเหตุผลสลิปไม่ผ่าน (แอดมิน Reject สลิป) */}
        {isRejectedSlip && rejectedPayment?.note && (
          <div className="w-full mt-1 mb-1 p-3 bg-red-50/80 border border-red-200 rounded-xl flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[11px] text-red-700 leading-relaxed">
              <span className="font-bold">สลิปถูกปฏิเสธ:</span> {rejectedPayment.note}
            </p>
          </div>
        )}

        <div className="flex justify-between items-end mt-1">
          <div className="flex flex-col transition-opacity duration-300">
            {isExpiringSoon && !isLocked ? (
              <p className="text-[11px] text-[#E57373] font-bold mb-1 tracking-wide">เหลืออีก {daysLeft} วัน</p>
            ) : (
              <p className="text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-widest">
                {isCancelled ? 'วันที่ยกเลิก' : 'หมดอายุ'}
              </p>
            )}
            <p className={`text-sm font-semibold ${isLocked ? 'text-gray-400' : 'text-[#2D2D2D]'}`}>
              {isCancelled && details.cancelledAt 
                ? formatDate(details.cancelledAt) 
                : formatDate(sub.end_date)}
            </p>
          </div>

          <div className="flex items-center gap-2 z-10">
            {isTestMode && !isExpiringSoon && !isLocked && (
              <button onClick={handleForceExpire} className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2.5 py-2 rounded-xl hover:bg-orange-200 transition-colors active:scale-95">🧪 เทสต์หมดอายุ</button>
            )}

            {/* === ส่วน Action ด้านขวาล่าง === */}
            {isCancelled || isExpired ? (
              <div className="text-right pt-2">
                <p className="text-[11px] font-bold text-gray-400">
                  {isCancelled ? 'ปิดการเข้าถึงแล้ว' : 'สิ้นสุดระยะเวลาแพ็กเกจ'}
                </p>
              </div>
            ) : hasPendingPayment ? (
              <div className="text-right pt-2">
                <p className="text-[11px] font-bold text-yellow-600 animate-pulse">โปรดรอแอดมินตรวจสอบ...</p>
              </div>
            ) : isPendingSubscription || isRejectedSlip ? (
              <div className="flex items-center gap-3">
                <p className={`text-[10px] font-bold animate-pulse hidden sm:block ${isRejectedSlip ? 'text-red-500' : 'text-orange-500'}`}>
                  {isRejectedSlip ? 'กรุณาแนบสลิปใหม่' : 'รอชำระเงิน / แนบสลิป'}
                </p>
                
                {/* ปุ่มแบบ Animated Running Border พร้อมเฉดสีสดใสสุดๆ */}
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenPayment(sub); }}
                  className="relative inline-flex h-10 overflow-hidden rounded-xl p-[2.5px] transition-transform duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30 group"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_1.5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00C300_0%,#3b82f6_25%,#a855f7_50%,#00C300_75%,#3b82f6_100%)]" />
                  <span className="inline-flex h-full w-full items-center justify-center rounded-[9.5px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white whitespace-nowrap gap-1.5 relative z-10 transition-colors group-hover:from-blue-700 group-hover:via-indigo-700 group-hover:to-purple-700">
                    <svg className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    ชำระเงินเลย
                  </span>
                </button>
              </div>
            ) : isExpiringSoon ? (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPayment(sub); }}
                className={`flex items-center gap-1.5 text-sm font-bold py-2.5 px-5 rounded-xl border border-white/60 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 ${stackedPayment.months > 1 ? 'bg-red-50 text-red-600' : 'bg-gradient-to-br from-[#CCF0D4] to-[#BCE2E8] text-[#2D2D2D]'}`}
              >
                ต่ออายุ {stackedPayment.amount} ฿ {stackedPayment.months > 1 && <span className="text-[10px] ml-1 bg-red-100 px-1.5 py-0.5 rounded">x{stackedPayment.months}</span>}
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