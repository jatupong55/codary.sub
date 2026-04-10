'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

// รับ Props onRefresh เพื่อเอาไว้สั่งอัปเดตหน้า Dashboard หลักตอนสั่งซื้อเสร็จ
export default function StoreDrawer({
  onRefresh,
  subscriptions = []
}: {
  onRefresh?: () => void;
  subscriptions?: any[];
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ดึงข้อมูลใหม่ทุกครั้งที่กดเปิดลิ้นชัก
  useEffect(() => {
    if (isDrawerOpen) {
      fetchAvailableProducts();
    }
  }, [isDrawerOpen]);

  const fetchAvailableProducts = async () => {
    setIsLoading(true);
    try {
      // 1. ดึงข้อมูลจาก View ปลอดภัย (หรือชื่อตารางที่บอสใช้แก้ RLS ผ่านแล้ว)
      const { data: accData, error } = await supabase
        .from('safe_master_accounts') // ⚠️ ถ้าบอสใช้ตารางอื่นที่ตั้ง Policy ผ่านแล้ว เปลี่ยนชื่อตรงนี้ได้เลยนะคะ
        .select(`
          id, 
          max_slots, 
          status,
          products ( id, name, category, price ),
          subscriptions ( id, status )
        `);

      if (error) throw error;

      if (!accData || accData.length === 0) {
        setAvailableProducts([]);
        return;
      }

      // 2. ใช้ Map เพื่อกรอง Product ที่ว่างและตัดตัวซ้ำออก
      const availableProductsMap = new Map();

      accData.forEach((acc: any) => {
        // นับที่นั่งที่มีคนจองแล้ว (active หรือ pending)
        const occupiedSlots = acc.subscriptions?.filter(
          (sub: any) => sub.status === 'active' || sub.status === 'pending'
        ).length || 0;

        // ถ้าที่นั่งเหลือ -> ดึง Product มาโชว์
        if (acc.max_slots > occupiedSlots && acc.products) {
          const product = Array.isArray(acc.products) ? acc.products[0] : acc.products;

          if (product && !availableProductsMap.has(product.id)) {
            availableProductsMap.set(product.id, product);
          }
        }
      });

      // 3. เซ็ตค่าลง State เตรียมโชว์ให้ลูกค้าดู
      setAvailableProducts(Array.from(availableProductsMap.values()));
    } catch (error) {
      console.error('Error fetching available products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (product: any) => {
    // ด่านที่ 1: เช็กว่าในตะกร้ามี แบรนด์ (category) นี้อยู่แล้วหรือยัง?
    const isBrandInCart = cart.some(item => item.category === product.category);
    if (isBrandInCart) {
      Swal.fire({
        icon: 'warning',
        title: 'เลือกซ้ำไม่ได้นะคะ',
        text: `คุณมีแพ็กเกจ ${product.category} อยู่ในตะกร้าแล้วค่ะ`,
        confirmButtonColor: '#424242',
        timer: 3000
      });
      return; // เตะออก ไม่ให้เพิ่ม
    }

    // ด่านที่ 2: เช็กว่าลูกค้ามีแพ็กเกจแบรนด์นี้ "ในระบบ" อยู่แล้วหรือยัง?
    // (เช็กเฉพาะตัวที่สถานะเป็น active หรือ pending)
    const hasExistingSubscription = subscriptions.some(sub =>
      sub.products?.category === product.category &&
      (sub.status === 'active' || sub.status === 'pending')
    );

    if (hasExistingSubscription) {
      Swal.fire({
        icon: 'error',
        title: 'จำกัด 1 สิทธิ์ ต่อ 1 แบรนด์',
        text: `คุณมีแพ็กเกจ ${product.category} ในระบบแล้วค่ะ ไม่สามารถสมัครซ้ำได้`,
        confirmButtonColor: '#424242'
      });
      return; // เตะออก ไม่ให้เพิ่ม
    }

    // ✨ ถ้าผ่านทุกด่าน ก็หยิบใส่ตะกร้าได้เลย!
    setCart([...cart, product]);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาล็อกอินก่อนทำรายการ');

      // สร้างตัวแปรวันที่: วันนี้ และ วันหมดอายุ (บวกไป 1 เดือน)
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1); // บวกเพิ่ม 1 เดือน

      // เพิ่ม end_date เข้าไปใน Payload ด้วย!
      const newSubscriptions = cart.map(product => ({
        user_id: user.id,
        product_id: product.id,
        status: 'pending',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(), // 👈 ส่งตัวนี้ไปด้วย ฐานข้อมูลจะได้ไม่โวยวายค่ะ
      }));

      const { error } = await supabase.from('subscriptions').insert(newSubscriptions);
      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'ลงทะเบียนสำเร็จ!',
        text: 'รายการของคุณอยู่ในสถานะรอดำเนินการ กรุณารอแอดมินตรวจสอบนะคะ',
        confirmButtonColor: '#424242',
        confirmButtonText: 'ตกลง'
      });

      setCart([]);
      setIsDrawerOpen(false);

      if (onRefresh) onRefresh();

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'อุ๊ย! เกิดข้อผิดพลาด',
        text: error.message,
        confirmButtonColor: '#424242',
        confirmButtonText: 'ลองใหม่'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* --- ✨ ปุ่มเปิด Drawer (โชว์อยู่บนหน้า Dashboard) --- */}
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

      {/* --- ✨ Drawer Section --- */}
      {/* 1. Backdrop สีดำโปร่งแสง */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#424242]/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        ></div>
      )}

      {/* 2. ตัวลิ้นชัก (สไลด์จากขวา) */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
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

        {/* Body (รายการสินค้า) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8F9FA]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <div className="w-8 h-8 border-4 border-[#AED9E0] border-t-[#424242] rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-gray-400 animate-pulse">กำลังตรวจสอบแพ็กเกจว่าง...</p>
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="text-center flex flex-col items-center justify-center h-full opacity-60">
              <span className="text-4xl mb-3">🥲</span>
              <p className="text-gray-500 font-bold">ไม่มีแพ็กเกจว่างในขณะนี้</p>
              <p className="text-xs text-gray-400 mt-1">กรุณาลองใหม่ในภายหลัง</p>
            </div>
          ) : (
            availableProducts.map(product => {
              const inCart = cart.some(item => item.id === product.id);
              return (
                <div
                  key={product.id}
                  className={`bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all duration-200 ${inCart ? 'border-[#F5C8E5] ring-2 ring-[#F5C8E5]/20' : 'border-gray-100 hover:border-[#AED9E0]'
                    }`}
                >
                  <div>
                    <span className="text-[10px] font-black text-[#AED9E0] bg-[#AED9E0]/10 px-2 py-1 rounded-md uppercase tracking-widest">
                      {product.category || 'PREMIUM'}
                    </span>
                    <h3 className="font-black text-[#424242] mt-2 text-lg leading-tight">{product.name}</h3>
                    <p className="text-[#424242]/60 font-bold text-sm mt-1">฿{product.price} / เดือน</p>
                  </div>
                  <button
                    onClick={() => inCart ? removeFromCart(product.id) : addToCart(product)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-90 ${inCart
                        ? 'bg-[#F5C8E5] text-[#424242]'
                        : 'bg-[#F8F9FA] text-gray-400 hover:bg-[#424242] hover:text-white border border-gray-200'
                      }`}
                  >
                    {inCart ? (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer (ตะกร้าและปุ่ม Checkout) */}
        <div className="border-t border-gray-100 p-6 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)] relative z-10">
          <div className="flex justify-between items-end mb-5">
            <div>
              <span className="font-bold text-gray-400 text-sm uppercase tracking-wider">ยอดรวมสุทธิ</span>
              <p className="text-xs text-gray-400 font-medium">{cart.length} รายการ</p>
            </div>
            <span className="text-3xl font-black text-[#424242]">
              ฿{cart.reduce((sum, item) => sum + item.price, 0)}
            </span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all duration-300 ${cart.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#424242] text-white hover:bg-[#2A2A2A] hover:shadow-lg hover:-translate-y-0.5'
              }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                กำลังดำเนินการ...
              </>
            ) : (
              'ลงทะเบียนแพ็กเกจ'
            )}
          </button>
        </div>
      </div>
    </>
  );
}