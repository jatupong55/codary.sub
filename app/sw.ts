/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// เพิ่มการล้าง Cache เก่าแบบ Manual เมื่อ Service Worker ตัวใหม่ทำงาน
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // ลบ Cache ที่ไม่ใช่ของเวอร์ชันปัจจุบัน (ถ้าจำเป็น)
          // ในที่นี้เราสั่งลบเพื่อให้เบราว์เซอร์เริ่มเก็บไฟล์จาก Build ใหม่ทั้งหมด
          return caches.delete(cacheName);
        })
      );
    })
  );
});

serwist.addEventListeners();

// Push Event Listener for Web Push Notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "Codary Sub";
  const options = {
    body: data.body || "มีการแจ้งเตือนใหม่สำหรับคุณ",
    icon: "/codary-sub-symbol.png", // ใช้ไอคอนเดิมที่มีใน manifest
    badge: "/apple-touch-icon.png",
    data: data.data || { url: "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Listener
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
