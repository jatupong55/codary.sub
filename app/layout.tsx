import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; 
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// 1. เพิ่ม Viewport เพื่อกำหนดสีของแถบสถานะ (Status bar) บนมือถือ
export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // ป้องกันการซูมหน้าจอเมื่อกด Input
};

// 2. อัปเดต Metadata โดยการชี้ไปที่ manifest.json
export const metadata: Metadata = {
  title: "Codary Sub | จัดการแพ็กเกจสตรีมมิ่งของคุณ",
  description: "แพลตฟอร์มแชร์และจัดการแพ็กเกจสตรีมมิ่งที่ง่าย สะดวก และปลอดภัยที่สุด",
  keywords: "สตรีมมิ่ง, แชร์แพ็กเกจ, Spotify, ต่ออายุ",
  manifest: "/manifest.json", // <-- เพิ่มบรรทัดนี้ครับ
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Codary Sub",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={inter.className}>{children}</body>
    </html>
  );
}