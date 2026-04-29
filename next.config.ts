import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  // ล้าง Cache เก่าที่ไม่ได้ใช้แล้วทิ้งอัตโนมัติ
  // cleanupOutdatedCaches: true, // หมายเหตุ: Serwist บางเวอร์ชันอาจจะจัดการให้อัตโนมัติใน sw.ts
});

const nextConfig: NextConfig = {
  // your existing config
};

export default withSerwist(nextConfig);
