'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

// Utility 
function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationPrompt({ userId }: { userId: string }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
  };

  const subscribeUser = async () => {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        Swal.fire({
          icon: 'warning',
          title: 'ถูกปฏิเสธ',
          text: 'คุณไม่ได้รับอนุญาตให้ส่งการแจ้งเตือน โปรดเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์',
          confirmButtonColor: '#111827',
          customClass: { popup: 'rounded-2xl' }
        });
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const applicationServerKey = urlB64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // ส่ง Subscription ไปบันทึกในฐานข้อมูล
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          subscription
        }),
      });

      if (!response.ok) throw new Error('Failed to save subscription');

      setIsSubscribed(true);

      Swal.fire({
        icon: 'success',
        title: 'เปิดแจ้งเตือนสำเร็จ!',
        text: 'คุณจะได้รับการอัปเดตสถานะแพ็กเกจผ่านทางเบราว์เซอร์หรืออุปกรณ์นี้',
        confirmButtonColor: '#111827',
        customClass: { popup: 'rounded-2xl' }
      });

    } catch (err) {
      console.error('Error during push subscription:', err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถเปิดการแจ้งเตือนได้ในขณะนี้',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported || isSubscribed) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-6 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">
          <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-800">เปิดรับการแจ้งเตือน</h4>
          <p className="text-xs text-gray-500">เพื่อรับข่าวสารและโปรโมชั่น</p>
        </div>
      </div>
      <button
        onClick={subscribeUser}
        disabled={isLoading}
        className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[100px]"
      >
        {isLoading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>กำลังเปิด...</span>
          </>
        ) : (
          'เปิดใช้งาน'
        )}
      </button>
    </div>
  );
}
