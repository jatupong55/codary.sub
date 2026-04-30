# 📦 Codary Sub (Subscription Management Platform)

## 📌 วัตถุประสงค์ (Objective)
**Codary Sub** คือแพลตฟอร์มบริหารจัดการแพ็กเกจสมาชิก (Subscription Management) สำหรับบริการดิจิทัล เช่น ระบบแชร์บ้าน Streaming หรือบริการรายเดือนต่างๆ แพลตฟอร์มนี้ถูกสร้างขึ้นเพื่อ **"ลดภาระและประหยัดเวลาของแอดมิน"** ในการจัดการข้อมูลลูกค้า, ตรวจสอบสลิปโอนเงิน, และการแจ้งเตือนต่ออายุแพ็กเกจ ด้วยการผสานระบบการทำงานแบบอัตโนมัติ (Automation) อย่างครบวงจร

## ✨ ฟีเจอร์หลัก (Features)

### 👥 สำหรับลูกค้า (User Experience)
- **LINE Login (OAuth2):** ล็อกอินเข้าสู่ระบบได้ทันทีด้วยบัญชี LINE ไม่ต้องจำรหัสผ่าน หรืออีเมล
- **User Dashboard:** จัดการแพ็กเกจของตัวเอง, ตรวจสอบวันหมดอายุ และดูประวัติการต่ออายุ
- **PromptPay QR Code:** สร้าง QR Code โอนเงินพร้อมเพย์อัตโนมัติตามยอดที่กำหนด (รองรับระบบสุ่มเศษสตางค์)
- **Omnichannel Notifications:** ลูกค้าไม่พลาดทุกการแจ้งเตือน ไม่ว่าจะเป็น LINE Push Message, อีเมล, หรือ Web Push Notifications (PWA Pop-up)

### 🛡️ สำหรับแอดมิน (Admin & Backoffice)
- **SlipOK Integration:** ระบบตรวจสอบสลิปอัตโนมัติด้วย AI ป้องกันสลิปปลอม สลิปซ้ำ และต่ออายุให้ลูกค้าแบบทันที (Auto-Renewal)
- **Admin Bypass Mode:** สลับไปใช้โหมดตรวจสอบสลิปแบบ Manual ได้ทันที หากระบบ API ภายนอกมีปัญหา
- **Inventory & Master Accounts:** จัดการ "บัญชีบ้าน" (Master Account), เช็คโควตาสมาชิก, และคำนวณกำไรสุทธิ (Margin %) ต่อบ้าน
- **Financial Overview:** แดชบอร์ดสรุปยอดขายรายเดือน, ต้นทุน, และกำไร
- **Broadcast Web Push:** ส่งข้อความ Push ประกาศข่าวสารหาลูกค้าทุกคนได้ในคลิกเดียวจากหน้า Admin

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + UI Components (SweetAlert2, React Datepicker)
- **Backend / Database:** Supabase (PostgreSQL, Row Level Security, Auth)
- **PWA Support:** Serwist (สำหรับ Service Worker)
- **External APIs:**
  - LINE Login API & LINE Messaging API
  - SlipOK API (ตรวจสอบสลิป)
  - Resend API (สำหรับส่งอีเมล)
- **Infrastructure:** Vercel (Hosting & Vercel Cron Jobs)

## 📋 สิ่งที่ต้องเตรียมพร้อม (Prerequisites)
ก่อนเริ่มติดตั้งโปรเจ็ค กรุณาตรวจสอบให้แน่ใจว่าคุณมีสิ่งเหล่านี้:
- **Node.js** (เวอร์ชัน 18.17 ขึ้นไป)
- **Git**
- **Supabase Account** (สำหรับตั้งค่าฐานข้อมูลฟรี)
- **LINE Developers Account** (สำหรับสร้าง Channel แบบ LINE Login และ Messaging API)
- **SlipOK Account** (หากต้องการใช้ระบบตรวจสอบสลิปอัตโนมัติ)
- **Resend Account** (หากต้องการเปิดใช้ระบบส่งอีเมล)

## 🚀 วิธีการติดตั้ง (Installation Guide)

1. **Clone Repository:**
   ```bash
   git clone <your-repo-url>
   cd codary-sub
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   # หรือ yarn install, pnpm install
   ```

3. **ตั้งค่า Environment Variables:**
   - คัดลอกไฟล์ `.env.example` (หรือสร้างไฟล์ใหม่ชื่อ `.env.local`)
   - กรอกข้อมูล API Keys ของคุณลงไปให้ครบถ้วน (เช่น Supabase, LINE, SlipOK, Resend, VAPID)
   ```bash
   cp .env.example .env.local
   ```

4. **ตั้งค่าฐานข้อมูล (Supabase):**
   - ไปที่ [Supabase Dashboard](https://supabase.com) และสร้างโปรเจ็คใหม่
   - ไปที่เมนู **SQL Editor**
   - คัดลอกโค้ดทั้งหมดจากไฟล์ `database.sql` ที่อยู่ในโฟลเดอร์โปรเจ็ค ไปวางและกด **Run** เพื่อสร้างตารางทั้งหมดที่จำเป็น

5. **รันเซิร์ฟเวอร์ในโหมด Development:**
   ```bash
   npm run dev
   ```
   *หมายเหตุ: หากต้องการทดสอบระบบ Web Push Notification และ PWA ในเครื่องตัวเอง ให้รัน `npm run build` ตามด้วย `npm run start` เพื่อจำลองสภาพแวดล้อม Production*

Craft By Major9 Codary.dev
