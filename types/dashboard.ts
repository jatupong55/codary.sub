// types/dashboard.ts
// Shared TypeScript type definitions สำหรับ Dashboard และ components ทั้งหมด

// --- สินค้า (ดึงจาก Supabase: products table) ---
export interface DashboardProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  yearly_price?: number | null;
  icon?: string | null;
  bg_color?: string | null;
}

// --- ประวัติการชำระเงิน ---
export interface Payment {
  id: string;
  status: string;
  amount: number;
  method?: string;
  slip_url?: string | null;
  note?: string | null;
  created_at: string;
}

// --- ข้อมูล Subscription Details (เก็บใน jsonb column) ---
export interface SubscriptionDetails {
  address?: string;
  inviteLink?: string;
  note?: string;
  cancelReason?: string;
  cancelledAt?: string;
  cancelAtPeriodEnd?: boolean;
  nextBillingDate?: string;
  retailPrice?: number;
  expectedPrice?: number;
  fullPrice?: number;
}

// --- Subscription หลัก (ดึงจาก Supabase พร้อม join) ---
export interface DashboardSubscription {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  billing_cycle: string;
  details?: SubscriptionDetails | null;
  products?: DashboardProduct[] | null;
  payments?: Payment[] | null;
}

// --- ข้อมูลโปรไฟล์ผู้ใช้ ---
export interface UserProfile {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  line_user_id?: string | null;
}
