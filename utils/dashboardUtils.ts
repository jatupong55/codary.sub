// src/utils/dashboardUtils.ts

export const calculateStackedPayment = (endDateStr: string, basePrice: number, category: string) => {
  if (category !== 'spotify') return { amount: basePrice, months: 1 };

  const endDate = new Date(endDateStr);
  const today = new Date();

  const currentBillingMonth = today.getDate() >= 26 ? today.getMonth() + 1 : today.getMonth();
  const endBillingMonth = endDate.getMonth();
  
  const monthsDiff = (today.getFullYear() * 12 + currentBillingMonth) - (endDate.getFullYear() * 12 + endBillingMonth);
  const multiplier = Math.max(1, 1 + monthsDiff);

  return {
    amount: basePrice * multiplier,
    months: multiplier
  };
};

export const calculateDaysLeft = (endDateStr: string) => {
  const end = new Date(endDateStr);
  const today = new Date();
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (dateStr: string) => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('th-TH', options);
};