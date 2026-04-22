// app/api/verify-slip/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendLineAdmin } from '@/lib/lineNotify'

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
    // ทางแยก A: เปิดโหมด BYPASS (ข้าม API, รอแอดมินตรวจแบบ Manual)
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

      await sendLineAdmin(`มีสลิปใหม่รอตรวจสอบ!\nยอดเงิน: ${expectedAmount} บาท\nรหัสลูกค้า: ${userId}`);

      // 2. ส่งกลับให้ Frontend แจ้งเตือนลูกค้า
      return NextResponse.json({
        success: true,
        pendingAdmin: true,
        message: 'อัปโหลดสลิปเรียบร้อย กรุณารอตรวจสอบ'
      });
    }

    // ----------------------------------------------------------------------
    // ทางแยก B: ปิดโหมด BYPASS (ใช้ SlipOK ตรวจสอบอัตโนมัติ)
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

    // [UPDATE] ตรงสเตปที่ 3 ในโค้ดเดิม ให้เพิ่มการดึงคอลัมน์ billing_cycle
    const { data: subData, error: fetchSubError } = await supabaseAdmin
      .from('subscriptions')
      .select('end_date, details, master_account_id, billing_cycle, products ( category )') // [NEW] ดึง billing_cycle
      .eq('id', subscriptionId)
      .single();

    if (fetchSubError) throw fetchSubError;

    const productsData = subData.products as { category?: string } | { category?: string }[] | null;
    const category = Array.isArray(productsData) ? productsData[0]?.category : productsData?.category;
    const details = subData.details || {};

    // ดึงรอบบิลจากตาราง subscriptions โดยตรง
    const billingCycle = subData.billing_cycle || 'monthly';
    
    let currentEndDate = new Date(subData.end_date);
    const today = new Date();
    
    // ปรับให้ใช้ Logic มาตรฐานเดียวกันทุกแพ็กเกจ
    if (currentEndDate < today) {
      currentEndDate = new Date(today);
    }
    
    let newEndDate = new Date(currentEndDate);
    let newNextBillingDate = details.nextBillingDate ? new Date(details.nextBillingDate) : new Date(currentEndDate);

    // [NEW] คำนวณบวกเวลาตามประเภทที่ลูกค้าสมัคร (รายเดือน หรือ รายปี)
    if (billingCycle === 'yearly' || billingCycle === 'รายปี') {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      newNextBillingDate.setFullYear(newNextBillingDate.getFullYear() + 1);
    } else {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
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

    await sendLineAdmin(`ชำระเงินอัตโนมัติสำเร็จ!\nรหัสลูกค้า: ${userId}\nแพ็กเกจ: ${category}\n รบกวนแอดมินเข้าไประบุบัญชีบ้าน (Master Account) ให้ลูกค้าด้วยค่ะ`);
    return NextResponse.json({
      success: true,
      pendingAdmin: false,
      message: 'ต่ออายุแพ็กเกจอัตโนมัติสำเร็จ',
      newEndDate: newEndDate.toISOString()
    });

  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }, { status: 500 });
  }
}