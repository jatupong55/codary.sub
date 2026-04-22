// types/admin.ts
// Shared TypeScript type definitions สำหรับหน้า Admin ทั้งหมด

export interface AdminProduct {
  id: string;
  name: string;
  category: string;
  price?: number;
  yearly_price?: number | null;
  icon?: string | null;
  bg_color?: string | null;
}

// Alias สำหรับความเข้ากันได้ย้อนหลัง
export type Product = AdminProduct;

export interface AdminPayment {
  id: string;
  status: string;
  amount: number;
  created_at: string;
  method?: string;
  slip_url?: string | null;
  note?: string | null;
}

export interface AdminSubscriptionDetails {
  cancelReason?: string;
  cancelledAt?: string;
  cancelAtPeriodEnd?: boolean;
  nextBillingDate?: string;
  retailPrice?: number;
  expectedPrice?: number;
  note?: string;
  address?: string;
  inviteLink?: string;
}

// Alias สำหรับความเข้ากันได้ย้อนหลัง
export type SubscriptionDetails = AdminSubscriptionDetails;

export interface AdminSubscription {
  id: string;
  user_id: string;
  product_id: string;
  master_account_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
  billing_cycle: string;
  details?: AdminSubscriptionDetails | null;
  // Joins
  users?: { id: string; display_name: string; email: string }[] | { id: string; display_name: string; email: string } | null;
  products?: AdminProduct[] | AdminProduct | null;
  master_accounts?: AdminMasterAccount[] | AdminMasterAccount | null;
  payments?: AdminPayment[] | null;
}

export interface AdminMasterAccount {
  id: string;
  product_id: string;
  email: string;
  password?: string | null;
  max_slots: number;
  cost: number;
  billing_cycle: string;
  status: string;
  next_renewal_date?: string | null;
  created_at?: string;
  details?: any;
  // Joins
  products?: AdminProduct[] | AdminProduct | null;
  subscriptions?: { id: string; status: string }[] | null;
}

// Alias สำหรับความเข้ากันได้ย้อนหลัง
export type MasterAccount = AdminMasterAccount;

export interface GroupedAdminUser {
  userId: string;
  displayName: string;
  email: string;
  subs: AdminSubscription[];
}

export type GroupedUser = GroupedAdminUser;

// === ส่วนของ Inventory Form (รักษาสภาพเดิมไว้) ===
export interface InventoryFormData {
  product_id: string;
  email: string;
  password: string;
  max_slots: number;
  cost: number;
  billing_cycle: string;
  status: string;
  next_renewal_date: string;
}

export interface InventoryDetailsData {
  address: string;
  inviteLink: string;
  note: string;
}
