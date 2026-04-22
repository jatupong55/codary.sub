// components/admin/ProfitAnalysis.tsx
'use client';

import { formatCurrency } from '@/utils/subscriptionUtils';

interface PaymentData {
  amount: number;
  subscriptions: {
    products: {
      name: string;
      category: string;
    } | null;
  } | null;
}

interface MasterAccountData {
  cost: number;
  products: {
    name: string;
    category: string;
  } | null;
}

interface ProfitAnalysisProps {
  payments: any[];
  masterAccounts: any[];
}

export default function ProfitAnalysis({ payments, masterAccounts }: ProfitAnalysisProps) {
  // 1. จัดกลุ่มรายรับตามสินค้า
  const revenueByProduct: Record<string, number> = {};
  payments.forEach(p => {
    const product = Array.isArray(p.subscriptions?.products) 
      ? p.subscriptions.products[0] 
      : p.subscriptions?.products;
    
    const name = product?.name || 'อื่นๆ';
    revenueByProduct[name] = (revenueByProduct[name] || 0) + (p.amount || 0);
  });

  // 2. จัดกลุ่มต้นทุนตามสินค้า
  const costByProduct: Record<string, number> = {};
  masterAccounts.forEach(acc => {
    const product = Array.isArray(acc.products) ? acc.products[0] : acc.products;
    const name = product?.name || 'อื่นๆ';
    costByProduct[name] = (costByProduct[name] || 0) + (acc.cost || 0);
  });

  // 3. รวมรายการสินค้าทั้งหมดที่มี
  const allProducts = Array.from(new Set([...Object.keys(revenueByProduct), ...Object.keys(costByProduct)]));

  return (
    <div className="bg-white/70 backdrop-blur-lg border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
          <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </span>
          วิเคราะห์กำไรแยกตามสินค้า (เดือนปัจจุบัน)
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-gray-400 bg-gray-50/50">
              <th className="px-6 py-4 font-bold">ชื่อสินค้า</th>
              <th className="px-6 py-4 font-bold text-right">รายรับ (Revenue)</th>
              <th className="px-6 py-4 font-bold text-right">ต้นทุน (Cost)</th>
              <th className="px-6 py-4 font-bold text-right">กำไร (Profit)</th>
              <th className="px-6 py-4 font-bold text-right">Margin (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allProducts.map(name => {
              const revenue = revenueByProduct[name] || 0;
              const cost = costByProduct[name] || 0;
              const profit = revenue - cost;
              const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

              return (
                <tr key={name} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-700 group-hover:text-blue-600 transition-colors">{name}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 font-medium">
                    ฿{formatCurrency(revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-red-400">
                    ฿{formatCurrency(cost)}
                  </td>
                  <td className={`px-6 py-4 text-right font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profit >= 0 ? '+' : ''}฿{formatCurrency(profit)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      margin >= 30 ? 'bg-green-100 text-green-700' : 
                      margin >= 10 ? 'bg-blue-100 text-blue-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Total Row */}
            <tr className="bg-gray-900 text-white font-bold">
              <td className="px-6 py-4 rounded-bl-3xl">รวมทั้งหมด</td>
              <td className="px-6 py-4 text-right">
                ฿{formatCurrency(Object.values(revenueByProduct).reduce((a, b) => a + b, 0))}
              </td>
              <td className="px-6 py-4 text-right text-red-300">
                ฿{formatCurrency(Object.values(costByProduct).reduce((a, b) => a + b, 0))}
              </td>
              <td className="px-6 py-4 text-right text-green-400">
                ฿{formatCurrency(Object.values(revenueByProduct).reduce((a, b) => a + b, 0) - Object.values(costByProduct).reduce((a, b) => a + b, 0))}
              </td>
              <td className="px-6 py-4 text-right rounded-br-3xl">
                {((Object.values(revenueByProduct).reduce((a, b) => a + b, 0) - Object.values(costByProduct).reduce((a, b) => a + b, 0)) / 
                Object.values(revenueByProduct).reduce((a, b) => (a + b) || 1, 0) * 100).toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
