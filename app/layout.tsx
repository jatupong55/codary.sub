import type { Metadata } from "next";
import { Inter } from "next/font/google"; // หรือฟอนต์ที่คุณใช้อยู่
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// --- แก้ไข Title และ Description ตรงนี้เลยครับ ---
export const metadata: Metadata = {
  title: "Codary Sub | จัดการแพ็กเกจสตรีมมิ่งของคุณ",
  description: "แพลตฟอร์มแชร์และจัดการแพ็กเกจสตรีมมิ่งที่ง่าย สะดวก และปลอดภัยที่สุด",
  keywords: "สตรีมมิ่ง, แชร์แพ็กเกจ, Spotify, ต่ออายุ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // แนะนำให้เปลี่ยน lang="en" เป็น "th" ด้วยครับ Chrome จะได้ไม่เด้งแปลภาษา
    <html lang="th">
      <body className={inter.className}>{children}</body>
    </html>
  );
}