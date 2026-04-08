'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';

// ============================================================================
// ฟังก์ชันสมองกล: คำนวณยอดทบ (Stacking) ตามกฎวันที่ 26 ของ Spotify
// ============================================================================
const calculateStackedPayment = (endDateStr: string, basePrice: number, category: string) => {
  // ถ้าไม่ใช่ Spotify ให้จ่ายราคาปกติ (1 รอบบิล)
  if (category !== 'spotify') return { amount: basePrice, months: 1 };

  const endDate = new Date(endDateStr);
  const today = new Date();

  // กำหนดให้วันที่ 26 คือจุดตัดรอบบิล (Cut-off) ของเดือนนั้น
  // ถ้าวันนี้เลยวันที่ 25 ไปแล้ว (>= 26) ให้ถือว่าถูกบวกไปอีก 1 บิลลิ่ง
  const currentBillingMonth = today.getDate() >= 26 ? today.getMonth() + 1 : today.getMonth();
  const endBillingMonth = endDate.getMonth();
  
  // หาผลต่างของเดือนระหว่างวันนี้ กับวันที่แพ็กเกจหมดอายุ
  const monthsDiff = (today.getFullYear() * 12 + currentBillingMonth) - (endDate.getFullYear() * 12 + endBillingMonth);
  
  // คำนวณตัวคูณ (ขั้นต่ำต้องจ่าย 1 เดือนเสมอ)
  const multiplier = Math.max(1, 1 + monthsDiff);

  return {
    amount: basePrice * multiplier,
    months: multiplier
  };
};

// ============================================================================
// 1. Component DetailDrawer
// ============================================================================
const DetailDrawer = ({ isOpen, onClose, sub, userProfile }: { isOpen: boolean, onClose: () => void, sub: any, userProfile: any }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [activeSub, setActiveSub] = useState(sub);
  
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });
  
  // 1. เพิ่ม State สำหรับเก็บ URL รูปสลิปที่จะให้ขยายดู
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

  const details = activeSub.details || {};
  const isSpotify = activeSub.products.category === 'spotify';
  const nextDate = details.nextBillingDate ? new Date(details.nextBillingDate).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  }) : '-';

  const basePrice = details.retailPrice || activeSub.products.price;
  const stackedPayment = calculateStackedPayment(activeSub.end_date, basePrice, activeSub.products.category);

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
              <div className="w-14 h-14 shrink-0 bg-white border border-gray-100 rounded-[1.2rem] flex items-center justify-center shadow-sm">
                {isSpotify ? (
                  <svg className="w-9 h-9 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8" viewBox="0 0 24 24">
                    <path fill="#f35325" d="M11.4 24H0V12.6h11.4V24zM11.4 11.4H0V0h11.4v11.4z"/>
                    <path fill="#81bc06" d="M24 24H12.6V12.6H24V24zM24 11.4H12.6V0H24v11.4z"/>
                    <path fill="#05a6f0" d="M11.4 24H0V12.6h11.4V24z"/>
                    <path fill="#ffba08" d="M24 24H12.6V12.6H24V24z"/>
                  </svg>
                )}
              </div>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md mb-2 inline-block ${isSpotify ? 'bg-[#CCF0D4] text-[#347144]' : 'bg-blue-50 text-blue-600'}`}>
                  {activeSub.products.category}
                </span>
                <h2 className="text-3xl font-black text-[#2D2D2D] leading-tight">{activeSub.products.name}</h2>
                <p className="text-sm font-medium text-gray-400 mt-1">แพ็กเกจ{details.billingCycle || 'รายปี'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-full transition-colors z-10 shrink-0">✕</button>
          </div>

          <div className="space-y-8 flex-1 relative z-10">
            {/* ข้อมูลบัญชีและการเข้าใช้ */}
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
                        <button onClick={() => handleCopy(details.address, 'ที่อยู่')} className="bg-white p-3 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors text-gray-500 group flex items-center justify-center">
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
                          onClick={() => handleCopy(details.inviteLink, 'ลิงก์คำเชิญ Spotify')} 
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
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                      <span className="text-sm font-medium text-gray-500">สถานะสมาชิก</span>
                      <span className="text-sm font-bold text-[#2D2D2D]">แชร์แล้ว {details.currentMembers || 0} จาก {details.maxMembers || 0} คน</span>
                    </div>
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                      <p className="text-xs text-blue-700 font-medium leading-relaxed">
                        {details.note || 'บัญชีของท่านได้รับการผูก License เรียบร้อยแล้ว สามารถเข้าใช้งานผ่าน Email ส่วนตัวได้ทันที'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* รายละเอียดราคา */}
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

            {/* ประวัติการชำระเงิน */}
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
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-tight ${payment.status === 'สำเร็จ' ? 'text-[#347144] bg-[#CCF0D4]/40' : 'text-orange-600 bg-orange-100'}`}>
                          {payment.status}
                        </span>
                        {/* 2. เปลี่ยน onClick จากเปิดหน้าใหม่ เป็นการโชว์ Image Lightbox */}
                        {payment.slip_url && (
                          <button 
                            onClick={() => setSelectedSlip(payment.slip_url)} 
                            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            ดูสลิป
                            {/* เปลี่ยนจาก External Link เป็นแว่นขยาย (Zoom In) น่ารักๆ */}
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

            {/* --- Support & Actions --- */}
            <section className="pt-4 space-y-3 pb-10">
              <button 
                onClick={() => {
                  // สร้างข้อความแจ้งปัญหา พร้อมดึงชื่อแพ็กเกจและอีเมล
                  const message = `🚨 แจ้งปัญหาการใช้งาน\n\nแพ็กเกจ: ${activeSub.products.name}\nบัญชี: ${userProfile?.email}\n\nรายละเอียดปัญหา: `;
                  const encodedText = encodeURIComponent(message);
                  
                  // ลบคำว่า text= ออก เหลือแค่ /? ตามด้วยข้อความที่เข้ารหัสแล้ว
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
                  // ยืนยันก่อนเด้งไป LINE ป้องกันลูกค้ากดโดนโดยไม่ได้ตั้งใจ
                  if(confirm('คุณต้องการแจ้งยกเลิกแพ็กเกจนี้ใช่หรือไม่? ระบบจะพาคุณไปยัง LINE เพื่อยืนยันกับแอดมิน')) {
                    const message = `💔 แจ้งยกเลิกแพ็กเกจ / ออกจากกลุ่ม\n\nแพ็กเกจ: ${activeSub.products.name}\nบัญชี: ${userProfile?.email}\n\nเหตุผลที่ต้องการยกเลิก: `;
                    const encodedText = encodeURIComponent(message);
                    
                    // ลบคำว่า text= ออกเช่นเดียวกันครับ
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

        {/* Toast Notification */}
        <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-[#2D2D2D] text-white px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-all duration-300 z-[90] ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95 pointer-events-none'}`}>
          <div className="bg-[#1DB954] w-5 h-5 rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
              <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
            </svg>
          </div>
          <span className="text-xs font-bold whitespace-nowrap">{toast.message}</span>
        </div>
      </div>

      {/* 3. กล่อง Lightbox สำหรับดูรูปภาพสลิปที่ซ้อนอยู่บนสุด */}
      {selectedSlip && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* ฉากหลังสีดำทึบ ช่วยขับให้รูปเด่นขึ้น */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300" 
            onClick={() => setSelectedSlip(null)} 
          />
          
          <div className="relative z-10 w-full max-w-[90vw] md:max-w-md flex flex-col items-center animate-in zoom-in-95 duration-300">
            {/* ปุ่มปิด */}
            <button 
              onClick={() => setSelectedSlip(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-all backdrop-blur-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* รูปภาพสลิป */}
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
};

// ============================================================================
// 2. Component หลักของหน้า Dashboard
// ============================================================================
export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [qrPayload, setQrPayload] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeDetailSub, setActiveDetailSub] = useState<any>(null);

  const MY_PROMPTPAY_ID = "0812345678";

  const fetchSubscriptions = useCallback(async (userId: string) => {
    const { data: subsData } = await supabase
      .from('subscriptions')
      .select(`
        id,
        start_date,
        end_date,
        status,
        master_account,
        details,
        products (
          id,
          name,
          category,
          price
        )
      `)
      .eq('user_id', userId)
      .order('end_date', { ascending: true });

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

  const handleUploadSlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setIsVerifying(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userProfile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('slips').upload(filePath, file);
      if (uploadError) throw new Error('ไม่สามารถอัปโหลดไฟล์ได้: ' + uploadError.message);

      const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(filePath);
      const slipUrl = publicUrlData.publicUrl;

      const response = await fetch('/api/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipUrl: slipUrl,
          expectedAmount: payAmount,
          subscriptionId: selectedSubId,
          userId: userProfile.id
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'การตรวจสอบสลิปล้มเหลว');

      await fetchSubscriptions(userProfile.id);
      handleClosePayment();
      setTimeout(() => alert('ตรวจสอบสลิปและต่ออายุแพ็กเกจสำเร็จเรียบร้อยแล้ว!'), 300);

    } catch (error: any) {
      console.error('Payment flow error:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง');
      setIsVerifying(false);
    }
  };

  const calculateDaysLeft = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('th-TH', options);
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
        <header className="relative overflow-hidden bg-white rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between mb-8 p-6 transition-all duration-300 hover:shadow-md">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00C300]/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <Image src="/codary-sub-full.svg" alt="Codary Sub Logo" width={160} height={48} priority className="w-auto h-12 mb-2 drop-shadow-sm" />
            <p className="text-sm text-gray-500 font-medium ml-1 tracking-wide">จัดการแพ็กเกจของคุณ</p>
          </div>

          <div className="relative z-10 flex flex-col items-end gap-2.5">
            <div className="p-1 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-100">
              <img src={userProfile.avatar_url} alt="Profile" className="w-12 h-12 rounded-full object-cover transition-transform duration-300 hover:scale-105" />
            </div>
            <button onClick={handleLogout} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50/80 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all duration-300 active:scale-95">
              <span className="text-[11px] font-semibold text-gray-500 group-hover:text-red-600 transition-colors duration-300">ออกจากระบบ</span>
              <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transform group-hover:translate-x-0.5 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

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
            subscriptions.map((sub) => {
              const daysLeft = calculateDaysLeft(sub.end_date);
              const isExpiringSoon = daysLeft <= 3;
              const product = sub.products;
              const details = sub.details || {};

              const isSpotify = product.category === 'spotify';
              const iconBg = isSpotify ? 'bg-[#2D2D2D]' : 'bg-blue-600';
              const iconText = isSpotify ? 'text-[#1DB954]' : 'text-white';
              const iconLabel = isSpotify ? 'SP' : 'M';
              const codaryPastelGradient = 'from-[#BCE2E8] via-[#F3CFE0] to-[#CCF0D4]';

              // --- เรียกใช้ฟังก์ชันคำนวณยอดทบ สำหรับปุ่มต่ออายุ ---
              const basePrice = details.retailPrice || product.price;
              const stackedPayment = calculateStackedPayment(sub.end_date, basePrice, product.category);

              return (
                <div
                  key={sub.id}
                  onClick={() => { if (!isExpiringSoon) handleOpenDetail(sub); }}
                  className="group relative p-[1.5px] rounded-[2rem] overflow-hidden transition-all duration-300 hover:scale-[0.99] active:scale-[0.97] bg-gray-100/50 cursor-pointer select-none touch-manipulation shadow-sm active:shadow-inner"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${codaryPastelGradient} opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300`}></div>

                  <div className="relative bg-white group-active:bg-gray-50/95 h-full w-full rounded-[calc(2rem-1.5px)] p-6 flex flex-col gap-5 transition-colors duration-300">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${iconBg} rounded-[1rem] flex items-center justify-center shadow-sm transition-all duration-300 group-hover:-rotate-3 group-active:scale-95 group-active:-rotate-6`}>
                          <span className={`${iconText} font-black text-lg`}>{iconLabel}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-[#2D2D2D] text-base transition-colors duration-300">{product.name}</h4>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">{sub.master_account || 'Personal License'}</p>
                        </div>
                      </div>
                      {isExpiringSoon ? (
                        <span className="text-[#E57373] bg-[#FFEBEE] text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider group-active:scale-95 transition-transform duration-300">Expiring Soon</span>
                      ) : (
                        <span className="text-[#347144] bg-[#CCF0D4]/60 text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider group-active:scale-95 transition-transform duration-300">Active</span>
                      )}
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="flex flex-col group-active:opacity-80 transition-opacity duration-300">
                        {isExpiringSoon ? (
                          <p className="text-[11px] text-[#E57373] font-bold mb-1 tracking-wide">เหลืออีก {daysLeft} วัน</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-widest">หมดอายุ</p>
                        )}
                        <p className="text-sm font-semibold text-[#2D2D2D]">{formatDate(sub.end_date)}</p>
                      </div>

                      {isExpiringSoon ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // ส่งยอดเงินที่ทบแล้ว ไปสร้าง QR Code !
                            handleOpenPayment(stackedPayment.amount, sub.id);
                          }}
                          className={`flex items-center gap-1.5 text-sm font-bold py-2.5 px-5 rounded-xl border border-white/60 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 z-10 ${stackedPayment.months > 1 ? 'bg-red-50 text-red-600' : 'bg-gradient-to-br from-[#CCF0D4] to-[#BCE2E8] text-[#2D2D2D]'}`}
                        >
                          ต่ออายุ {stackedPayment.amount} ฿ 
                          {/* แจ้งเตือนเล็กๆ ในปุ่มถ้ายอดทบ */}
                          {stackedPayment.months > 1 && <span className="text-[10px] ml-1 bg-red-100 px-1.5 py-0.5 rounded">x{stackedPayment.months}</span>}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400 text-sm font-semibold py-2 px-1 transition-all duration-300 group-hover:text-[#2D2D2D] group-hover:translate-x-1">
                          รายละเอียด <span className="text-lg">→</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
      
      <DetailDrawer 
        isOpen={isDetailOpen} 
        onClose={handleCloseDetail} 
        sub={activeDetailSub} 
        userProfile={userProfile} 
      />

      {isModalMounted && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative transform transition-all duration-300 ease-in-out ${isModalVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}>
            {!isVerifying && (
              <button onClick={handleClosePayment} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors duration-200">✕</button>
            )}
            <div className={`transition-opacity duration-300 ${isVerifying ? 'opacity-100' : 'opacity-100'}`}>
              {isVerifying ? (
                <div className="py-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#00C300] rounded-full animate-spin mb-6"></div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">กำลังตรวจสอบข้อมูล</h3>
                  <p className="text-sm text-gray-500">กรุณารอสักครู่ ระบบกำลังนำส่งและตรวจสอบสลิป...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center pt-2">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/PromptPay-logo.png/1200px-PromptPay-logo.png" alt="PromptPay" className="h-6 mb-4" />
                  <h3 className="text-xl font-extrabold text-gray-900 mb-1">สแกนเพื่อชำระเงิน</h3>
                  <p className="text-xs text-gray-500 mb-6">ยอดเงินรวมเศษสตางค์เพื่อการยืนยันตัวตนอัตโนมัติ</p>
                  <div className="bg-white p-4 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)] mb-6 border border-gray-100">
                    <QRCodeSVG value={qrPayload} size={200} />
                  </div>
                  <div className="bg-gray-50 w-full rounded-xl py-3 mb-6 border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">ยอดที่ต้องโอน (บาท)</p>
                    <p className="text-3xl font-extrabold text-[#00C300] tracking-tight">{payAmount.toFixed(2)}</p>
                  </div>
                  <label className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 cursor-pointer shadow-md text-center active:scale-95">
                    อัปโหลดรูปสลิป
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadSlip} disabled={isVerifying} />
                  </label>
                  <p className="mt-3 text-[10px] text-gray-400">รองรับไฟล์ .jpg, .png</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}