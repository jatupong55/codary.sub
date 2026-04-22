// utils/subscriptionUtils.ts
import { DashboardSubscription } from "@/types/dashboard";

/**
 * คำนวณยอดที่ต้องชำระ (รองรับระบบ Stacked Payment ของ Spotify)
 */
export const calculateStackedPayment = (endDateStr: string, basePrice: number, category: string) => {
  if (category?.toLowerCase()?.trim() !== 'spotify') return { amount: basePrice, months: 1 };

  const endDate = new Date(endDateStr);
  const today = new Date();

  // ตัดรอบบิลทุกวันที่ 26
  const currentBillingMonth = today.getDate() >= 26 ? today.getMonth() + 1 : today.getMonth();
  const endBillingMonth = endDate.getMonth();
  
  const monthsDiff = (today.getFullYear() * 12 + currentBillingMonth) - (endDate.getFullYear() * 12 + endBillingMonth);
  const multiplier = Math.max(1, 1 + monthsDiff);

  return {
    amount: basePrice * multiplier,
    months: multiplier
  };
};

/**
 * คำนวณจำนวนวันที่เหลือ
 */
export const calculateDaysLeft = (endDateStr: string | null | undefined) => {
  if (!endDateStr) return 0;
  const end = new Date(endDateStr);
  const today = new Date();
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * จัดรูปแบบวันที่เป็นภาษาไทย
 */
export const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('th-TH', options);
};

/**
 * ตรวจสอบว่า Subscription หมดอายุหรือยัง
 * เงื่อนไข: สถานะเป็น expired หรือ (วันที่เหลือ < 0 และไม่ใช่สถานะ pending/cancelled)
 */
export const isSubExpired = (sub: Pick<DashboardSubscription, 'status' | 'end_date'>) => {
  const daysLeft = calculateDaysLeft(sub.end_date);
  const isCancelled = sub.status === 'cancelled';
  const isPending = sub.status === 'pending';
  
  return sub.status === 'expired' || (daysLeft < 0 && !isPending && !isCancelled);
};

/**
 * จัดรูปแบบตัวเลขเป็นสกุลเงินบาท
 */
export const formatCurrency = (amount: number) => {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};
