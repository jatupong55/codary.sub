// app/api/verify-slip/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slipUrl, expectedAmount, subscriptionId, userId } = body;

    if (!slipUrl || !expectedAmount || !subscriptionId || !userId) {
      return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // สวิตช์สับเปลี่ยนโหมด
    const USE_BYPASS_SLIPOK = process.env.USE_BYPASS_SLIPOK === 'true';

    // ----------------------------------------------------------------------
    // 🚦 ทางแยก A: เปิดโหมด BYPASS (ข้าม API, รอแอดมินตรวจแบบ Manual)
    // ----------------------------------------------------------------------
    if (USE_BYPASS_SLIPOK) {
      // 1. บันทึกลงตาราง payments ด้วยสถานะ 'รอตรวจสอบ'
      const { error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          subscription_id: subscriptionId,
          user_id: userId,
          amount: expectedAmount,
          status: 'รอตรวจสอบ', // <-- หัวใจสำคัญของการให้ Admin ตรวจ
          method: 'Thai QR',
          slip_url: slipUrl
        });

      if (insertError) throw insertError;

      // 2. ส่งกลับให้ Frontend แจ้งเตือนลูกค้า
      return NextResponse.json({ 
        success: true, 
        pendingAdmin: true, 
        message: 'อัปโหลดสลิปเรียบร้อย กรุณารอตรวจสอบ' 
      });
    }

    // ----------------------------------------------------------------------
    // 🚦 ทางแยก B: ปิดโหมด BYPASS (ใช้ SlipOK ตรวจสอบอัตโนมัติ)
    // ----------------------------------------------------------------------
    const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY;
    const SLIPOK_BRANCH_ID = process.env.SLIPOK_BRANCH_ID;

    if (!SLIPOK_API_KEY || SLIPOK_API_KEY === 'ใส่_API_KEY_ของคุณที่นี่') {
      return NextResponse.json({ success: false, message: 'การตั้งค่า API SlipOK ไม่ถูกต้อง (หรือลืมเปิดโหมด Bypass)' }, { status: 500 });
    }

    // 1. ยิงตรวจสอบสลิปผ่าน SlipOK
    const response = await fetch(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, {
      method: 'POST',
      headers: {
        'x-authorization': SLIPOK_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: slipUrl })
    });

    const result = await response.json();
    
    if (!result.success) {
      return NextResponse.json({ success: false, message: 'สลิปไม่ถูกต้อง หรือถูกใช้งานไปแล้ว' }, { status: 400 });
    }
    
    if (result.data.amount !== expectedAmount) {
      return NextResponse.json({ success: false, message: `ยอดเงินไม่ถูกต้อง (ต้องการ ${expectedAmount} แต่โอนมา ${result.data.amount})` }, { status: 400 });
    }

    const slipReference = result.data.transRef;

    // 2. บันทึก Transaction กันสลิปซ้ำ
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        amount: expectedAmount,
        slipok_ref: slipReference,
        slip_image_url: slipUrl,
        status: 'success'
      });

    if (txError) {
      return NextResponse.json({ success: false, message: 'สลิปนี้ถูกใช้งานเข้าระบบไปแล้ว' }, { status: 400 });
    }

    // 3. ดึงข้อมูลแพ็กเกจปัจจุบัน + details + category
    const { data: subData, error: fetchSubError } = await supabaseAdmin
      .from('subscriptions')
      .select('end_date, details, products ( category )')
      .eq('id', subscriptionId)
      .single();

    if (fetchSubError) throw fetchSubError;

    // 4. คำนวณวันหมดอายุใหม่ (โค้ดเดิมของคุณ)
    const productsData: any = subData.products;
    const category = Array.isArray(productsData) ? productsData[0]?.category : productsData?.category;
    const details = subData.details || {};
    
    let currentEndDate = new Date(subData.end_date);
    const today = new Date();
    
    let newEndDate = new Date(currentEndDate);
    let newNextBillingDate = details.nextBillingDate ? new Date(details.nextBillingDate) : new Date(currentEndDate);

    if (category === 'spotify') {
      const currentBillingMonth = today.getDate() >= 26 ? today.getMonth() + 1 : today.getMonth();
      const endBillingMonth = currentEndDate.getMonth();
      const monthsDiff = (today.getFullYear() * 12 + currentBillingMonth) - (currentEndDate.getFullYear() * 12 + endBillingMonth);
      const monthsPaid = Math.max(1, 1 + monthsDiff);

      newEndDate.setMonth(newEndDate.getMonth() + monthsPaid);
      newNextBillingDate.setMonth(newNextBillingDate.getMonth() + monthsPaid);
    } else {
      if (currentEndDate < today) {
        newEndDate = new Date(today);
        newNextBillingDate = new Date(today);
      }
      const billingCycle = details.billingCycle || 'รายปี';
      if (billingCycle === 'รายเดือน') {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
      } else {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        newNextBillingDate.setFullYear(newNextBillingDate.getFullYear() + 1);
      }
    }

    const updatedDetails = {
      ...details,
      nextBillingDate: newNextBillingDate.toISOString().split('T')[0]
    };

    // 5. อัปเดต Subscriptions (เลื่อนวันหมดอายุ)
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        end_date: newEndDate.toISOString().split('T')[0],
        details: updatedDetails,
        status: 'active'
      })
      .eq('id', subscriptionId);

    if (updateError) throw updateError;

    // 6. บันทึกประวัติลงตาราง payments (สถานะ สำเร็จ)
    await supabaseAdmin
      .from('payments')
      .insert({
        subscription_id: subscriptionId,
        user_id: userId,
        amount: expectedAmount,
        status: 'สำเร็จ',
        method: 'Thai QR',
        slip_url: slipUrl
      });

    return NextResponse.json({ 
      success: true, 
      pendingAdmin: false,
      message: 'ต่ออายุแพ็กเกจอัตโนมัติสำเร็จ',
      newEndDate: newEndDate.toISOString()
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }, { status: 500 });
  }
}