// src/components/dashboard/PaymentModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

interface PaymentModalProps {
  isMounted: boolean;
  isVisible: boolean;
  onClose: () => void;
  payAmount: number;
  qrPayload: string;
  selectedSubId: string | null;
  userProfile: any;
  onSuccess: () => void;
}

export default function PaymentModal({
  isMounted, isVisible, onClose, payAmount, qrPayload, selectedSubId, userProfile, onSuccess
}: PaymentModalProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  // เคลียร์ State ทุกครั้งที่ Modal ถูกเปิดขึ้นมาใหม่
  useEffect(() => {
    if (isVisible) {
      setIsVerifying(false);
    }
  }, [isVisible]);

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

      onSuccess();
      onClose();

      // เปลี่ยนจากการใช้ alert() โบราณ มาใช้ SweetAlert2 สวยๆ
      setTimeout(() => {
        if (result.pendingAdmin) {
          Swal.fire({
            icon: 'info',
            title: 'ส่งสลิปเรียบร้อย',
            html: 'ระบบได้รับข้อมูลแล้ว<br>กรุณารอแอดมินตรวจสอบนะคะ',
            confirmButtonColor: '#111827',
            customClass: {
              popup: 'rounded-2xl'
            }
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'ต่ออายุสำเร็จ!',
            text: 'ระบบได้ตรวจสอบสลิปและต่ออายุแพ็กเกจให้คุณเรียบร้อยแล้ว',
            confirmButtonColor: '#111827',
            customClass: {
              popup: 'rounded-2xl'
            }
          });
        }
      }, 300);

    } catch (error: any) {
      console.error('Payment flow error:', error);
      setIsVerifying(false);

      // เปลี่ยน alert() ตรง Error ด้วย
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message || 'ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonColor: '#ef4444',
        customClass: {
          popup: 'rounded-2xl'
        }
      });
    }
  };

  if (!isMounted) return null;

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative transform transition-all duration-300 ease-in-out ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}>
        {!isVerifying && (
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors duration-200">✕</button>
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
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/c/c5/PromptPay-logo.png" 
                alt="PromptPay" 
                className="h-6 mb-4 object-contain" 
              />
              <h3 className="text-xl font-extrabold text-gray-900 mb-1">สแกนเพื่อชำระเงิน</h3>
              <p className="text-xs text-gray-500 mb-6">ยอดเงินรวมเศษสตางค์เพื่อการยืนยันตัวตนอัตโนมัติ</p>
              
              <div className="bg-white p-4 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)] mb-6 border border-gray-100 flex items-center justify-center min-h-[232px]">
                {qrPayload ? (
                  <QRCodeSVG value={qrPayload} size={200} />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-10 h-10 border-4 border-gray-100 border-t-[#00C300] rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-gray-400">กำลังสร้าง QR Code...</span>
                  </div>
                )}
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
  );
}