// src/components/dashboard/StoreDrawer.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { sendLineAdmin } from '@/lib/lineNotify';

const getBrandStyle = (category: string) => {
  const safeCategory = category?.toLowerCase()?.trim() || '';
  const styles: Record<string, { bg: string, logo: string }> = {
    spotify: { bg: 'bg-[#191414]', logo: 'https://cdn.simpleicons.org/spotify/1DB954' },
    netflix: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/netflix/E50914' },
    youtube: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/youtube/FF0000' },
    disney: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
    hbo: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/hbo/ffffff' },
    viu: { bg: 'bg-[#121212]', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Viu_logo.svg' },
    canva: { bg: 'bg-white border border-gray-100', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Canva_logo.svg' },
    google: { bg: 'bg-white border border-gray-100', logo: 'https://cdn.simpleicons.org/google/4285F4' },
    apple: { bg: 'bg-black', logo: 'https://cdn.simpleicons.org/apple/ffffff' },
    nintendo: { bg: 'bg-white border border-gray-100', logo: 'https://www.nintendo.co.jp/common/v2/img/ncommon/_common/logo/switch.svg' },
    ms365: { bg: 'bg-white border border-gray-100', logo: 'https://files.brandlogos.net/svg/RwAX3bZKbl/microsoft-365-copilot-logo-brandlogos.net_78lfgdevk.svg' },
  };
  return styles[safeCategory] || { bg: 'bg-gray-50 border border-gray-200', logo: '' };
};

export default function StoreDrawer({
  onRefresh,
  subscriptions = [],
  onCheckoutSuccess // [NEW] รับสัญญาณส่งต่อให้หน้า Payment
}: {
  onRefresh?: () => void;
  subscriptions?: any[];
  onCheckoutSuccess?: (price: number, subId: string) => void;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (isDrawerOpen) {
      fetchAvailableProducts();
    }
  }, [isDrawerOpen]);

  const fetchAvailableProducts = async () => {
    setIsLoading(true);
    try {
      const { data: accData, error } = await supabase
        .from('safe_master_accounts')
        .select(`
          id, 
          max_slots, 
          status,
          products ( id, name, category, price, yearly_price, icon, bg_color ),
          subscriptions ( id, status )
        `);

      if (error) throw error;

      if (!accData || accData.length === 0) {
        setAvailableProducts([]);
        return;
      }

      const existingCategories = subscriptions
        .filter(sub => sub.status === 'active' || sub.status === 'pending')
        .map(sub => sub.products?.category?.toLowerCase()?.trim());

      const availableProductsMap = new Map();

      accData.forEach((acc: any) => {
        const occupiedSlots = acc.subscriptions?.filter(
          (sub: any) => sub.status === 'active' || sub.status === 'pending'
        ).length || 0;

        const freeSlots = acc.max_slots - occupiedSlots;

        if (freeSlots > 0 && acc.products) {
          const product = Array.isArray(acc.products) ? acc.products[0] : acc.products;
          const safeCategory = product?.category?.toLowerCase()?.trim();

          if (product && !existingCategories.includes(safeCategory)) {
            if (availableProductsMap.has(product.id)) {
              const existingProduct = availableProductsMap.get(product.id);
              existingProduct.availableSlots += freeSlots;
            } else {
              availableProductsMap.set(product.id, { ...product, availableSlots: freeSlots });
            }
          }
        }
      });

      setAvailableProducts(Array.from(availableProductsMap.values()));
    } catch (error) {
      console.error('Error fetching available products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (product: any) => {
    // [UPDATE] บังคับตะกร้าให้มีของแค่ชิ้นเดียวเสมอ! (เลือกใหม่ไปทับของเก่าเลย)
    setCart([product]);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const getDisplayPrice = (product: any) => {
    if (billingCycle === 'yearly') {
      return product.yearly_price || (product.price * 12); 
    }
    return product.price;
  };

  const calculateDiscountPercent = (monthlyPrice: number, yearlyPrice: number) => {
    if (!yearlyPrice) return 0;
    const fullPrice = monthlyPrice * 12;
    if (yearlyPrice >= fullPrice) return 0;
    const discount = ((fullPrice - yearlyPrice) / fullPrice) * 100;
    return Math.round(discount);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาล็อกอินก่อนทำรายการ');

      const startDate = new Date();
      const endDate = new Date(startDate);
      
      if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const newSubscriptions = cart.map(product => ({
        user_id: user.id,
        product_id: product.id,
        status: 'pending',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        billing_cycle: billingCycle,
        details: { expectedPrice: getDisplayPrice(product) }
      }));

      // [UPDATE] ใส่ .select() เพื่อให้ Supabase ส่งข้อมูลที่มี ID กลับมาให้เรา
      const { data: insertedData, error } = await supabase
        .from('subscriptions')
        .insert(newSubscriptions)
        .select();
        
      if (error) throw error;

      // ปิดหน้าต่าง Store และโชว์ข้อความแปปนึง
      setIsDrawerOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'เตรียมการชำระเงิน',
        html: 'ระบบกำลังสร้าง QR Code ให้คุณ...',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-2xl' }
      });

      // ดึงราคาและยิงสัญญาณเปิดหน้า Payment ทันที!
      if (onCheckoutSuccess && insertedData && insertedData.length > 0) {
        const selectedProduct = cart[0];
        const finalPrice = getDisplayPrice(cart[0]); // เพราะมีแค่ชิ้นเดียวแน่นอน
        const subId = insertedData[0].id;
        
        // ปั้นข้อความแจ้งเตือนเข้า LINE แอดมิน
        const alertMessage = `🛒 [ออเดอร์ใหม่] ลูกค้ากดสั่งซื้อแพ็กเกจ!\n----------------------\n👤 ลูกค้า: ${user.email}\n🛍️ แพ็กเกจ: ${selectedProduct.name}\n🔄 รอบบิล: ${billingCycle === 'yearly' ? 'รายปี' : 'รายเดือน'}\n💰 ยอดที่ต้องชำระ: ฿${finalPrice.toLocaleString('th-TH')}\n----------------------\n⏳ ลูกค้ากำลังเข้าสู่หน้าสแกนชำระเงิน แอดมินเตรียมรอตรวจสลิปได้เลยครับ!`;
        await sendLineAdmin(alertMessage).catch(e => console.error('LINE Notify Error:', e));
        setTimeout(() => {
            onCheckoutSuccess(finalPrice, subId);
        }, 800); // ดีเลย์นิดนึงให้ UI ไม่กระตุก
      }

      setCart([]);
      if (onRefresh) onRefresh();

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลองใหม่',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="flex items-center gap-2 bg-[#D3F4DC] text-[#424242] px-4 py-2.5 rounded-xl font-black hover:bg-[#C2EACD] transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 relative"
      >
        <svg className="w-5 h-5 text-[#424242]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
        เพิ่มแพ็กเกจ
        {cart.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-[#424242] text-[#D3F4DC] w-6 h-6 flex items-center justify-center rounded-full text-xs font-black shadow-sm animate-bounce">
            {cart.length}
          </span>
        )}
      </button>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#424242]/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        ></div>
      )}

      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#F0F7F8]">
          <h2 className="text-xl font-black text-[#424242]">เลือกแพ็กเกจพรีเมียม</h2>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="text-gray-400 hover:text-[#424242] p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8F9FA]">
          
          <div className="flex bg-gray-100 p-1.5 rounded-xl shadow-inner mb-2">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                billingCycle === 'monthly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                billingCycle === 'yearly' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              รายปี
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <div className="w-8 h-8 border-4 border-[#AED9E0] border-t-[#424242] rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-gray-400 animate-pulse">กำลังตรวจสอบแพ็กเกจว่าง...</p>
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="text-center flex flex-col items-center justify-center h-full opacity-60">
              <span className="text-4xl mb-3 text-gray-300">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </span>
              <p className="text-gray-500 font-bold mt-2">ไม่มีแพ็กเกจว่างในขณะนี้</p>
              <p className="text-xs text-gray-400 mt-1">คุณอาจมีแพ็กเกจทั้งหมดแล้ว หรือสินค้าหมดสต๊อก</p>
            </div>
          ) : (
            availableProducts.map(product => {
              const inCart = cart.some(item => item.id === product.id);
              const brandStyle = getBrandStyle(product.category);
              
              const iconSource = product.icon || brandStyle.logo;
              const isUrl = iconSource?.startsWith('http') || iconSource?.startsWith('data:image');

              const useDatabaseColor = product.bg_color && product.bg_color !== '#f3f4f6';
              const containerStyle = useDatabaseColor ? { backgroundColor: product.bg_color } : {};
              const fallbackClass = useDatabaseColor ? '' : brandStyle.bg;

              const isLowStock = product.availableSlots <= 2;
              
              const currentPrice = getDisplayPrice(product);
              const discountPercent = calculateDiscountPercent(product.price, product.yearly_price);

              return (
                <div
                  key={product.id}
                  className={`bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all duration-200 ${
                    inCart ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50/30' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-sm overflow-hidden shrink-0 ${fallbackClass}`}
                      style={containerStyle}
                    >
                      {isUrl ? (
                        <img src={iconSource} alt={product.category} className="w-6 h-6 object-contain drop-shadow-sm" />
                      ) : iconSource ? (
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconSource} />
                        </svg>
                      ) : (
                        <span className="text-gray-400 font-black text-lg">{product.category?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-widest">
                          {product.category || 'PREMIUM'}
                        </span>
                        
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border ${
                          isLowStock 
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-red-600 animate-pulse' 
                            : 'bg-gradient-to-r from-[#D3F4DC] to-[#C2EACD] text-[#347144] border-[#B2D8BC]'
                        }`}>
                          {isLowStock ? (
                            <>
                              <svg className="w-3 h-3 text-yellow-300" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248z" clipRule="evenodd" />
                              </svg>
                              เหลือ {product.availableSlots} ที่สุดท้าย!
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              ว่าง {product.availableSlots} ที่
                            </>
                          )}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-base leading-tight line-clamp-1">{product.name}</h3>
                      
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-gray-500 font-semibold text-sm">
                          ฿{currentPrice.toLocaleString()} <span className="text-xs font-normal">/ {billingCycle === 'yearly' ? 'ปี' : 'เดือน'}</span>
                        </p>
                        {billingCycle === 'yearly' && discountPercent > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                            ประหยัด {discountPercent}%
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                  <button
                    onClick={() => inCart ? removeFromCart(product.id) : addToCart(product)}
                    className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                      inCart
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-200'
                    }`}
                  >
                    {inCart ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-gray-100 p-6 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)] relative z-10">
          <div className="flex justify-between items-end mb-5">
            <div>
              <span className="font-bold text-gray-400 text-sm uppercase tracking-wider">ยอดรวมสุทธิ</span>
              <p className="text-xs text-gray-500 font-medium">1 รายการ ({billingCycle === 'yearly' ? 'รายปี' : 'รายเดือน'})</p>
            </div>
            <span className="text-3xl font-black text-gray-800">
              ฿{cart.length > 0 ? getDisplayPrice(cart[0]).toLocaleString() : 0}
            </span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all duration-300 ${
              cart.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                กำลังดำเนินการ...
              </>
            ) : (
              'ยืนยันแพ็กเกจนี้'
            )}
          </button>
        </div>
      </div>
    </>
  );
}