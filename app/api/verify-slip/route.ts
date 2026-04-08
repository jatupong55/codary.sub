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

    const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY;
    const SLIPOK_BRANCH_ID = process.env.SLIPOK_BRANCH_ID;
    
    const USE_MOCK_SLIPOK = process.env.USE_MOCK_SLIPOK === 'true';
    
    let isSlipValid = false;
    let slipReference = '';

    if (!USE_MOCK_SLIPOK && SLIPOK_API_KEY && SLIPOK_API_KEY !== 'ใส่_API_KEY_ของคุณที่นี่') {
      const response = await fetch(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, {
        method: 'POST',
        headers: {
          'x-authorization': SLIPOK_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: slipUrl })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.data.amount === expectedAmount) {
          isSlipValid = true;
          slipReference = result.data.transRef;
        } else {
          return NextResponse.json({ success: false, message: 'ยอดเงินไม่ถูกต้อง' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ success: false, message: 'สลิปไม่ถูกต้อง หรือใช้ซ้ำ' }, { status: 400 });
      }
    } else {
      isSlipValid = true;
      slipReference = `MOCK-${Date.now()}`;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (isSlipValid) {
      // 1. บันทึก Transaction กันสลิปซ้ำ
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
        return NextResponse.json({ success: false, message: 'สลิปนี้ถูกใช้งานไปแล้ว' }, { status: 400 });
      }

      // 2. ดึงข้อมูลแพ็กเกจปัจจุบัน + details + category ของสินค้า
      const { data: subData, error: fetchSubError } = await supabaseAdmin
        .from('subscriptions')
        .select(`
          end_date, 
          details, 
          products ( category )
        `)
        .eq('id', subscriptionId)
        .single();

      if (fetchSubError) throw fetchSubError;

      // 3. เริ่มต้นคำนวณวันหมดอายุใหม่ (แก้ปัญหา TypeScript Array/Object ตรงนี้ครับ ✨)
      const productsData: any = subData.products;
      const category = Array.isArray(productsData) ? productsData[0]?.category : productsData?.category;
      
      const details = subData.details || {};
      
      let currentEndDate = new Date(subData.end_date);
      const today = new Date();
      
      let newEndDate = new Date(currentEndDate);
      let newNextBillingDate = details.nextBillingDate 
        ? new Date(details.nextBillingDate) 
        : new Date(currentEndDate);

      // --- สมองกลคำนวณวัน (แทนที่การบวกดื้อๆ 30 วัน) ---
      if (category === 'spotify') {
        // กฎ Spotify: ตัดรอบวันที่ 26 
        const currentBillingMonth = today.getDate() >= 26 ? today.getMonth() + 1 : today.getMonth();
        const endBillingMonth = currentEndDate.getMonth();
        const monthsDiff = (today.getFullYear() * 12 + currentBillingMonth) - (currentEndDate.getFullYear() * 12 + endBillingMonth);
        
        const monthsPaid = Math.max(1, 1 + monthsDiff);

        newEndDate.setMonth(newEndDate.getMonth() + monthsPaid);
        newNextBillingDate.setMonth(newNextBillingDate.getMonth() + monthsPaid);

      } else {
        // กฎ Microsoft (หรืออื่นๆ)
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

      // แปลงวันที่ให้อยู่ในฟอร์แมต YYYY-MM-DD
      const updatedDetails = {
        ...details,
        nextBillingDate: newNextBillingDate.toISOString().split('T')[0]
      };

      // 4. อัปเดต Subscriptions (เลื่อนวันหมดอายุ)
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          end_date: newEndDate.toISOString().split('T')[0],
          details: updatedDetails,
          status: 'active'
        })
        .eq('id', subscriptionId);

      if (updateError) throw updateError;

      // 5. บันทึกประวัติการชำระเงินลงตาราง payments (เพื่อให้โชว์ใน Drawer ได้ทันที)
      await supabaseAdmin
        .from('payments')
        .insert({
          subscription_id: subscriptionId,
          user_id: userId,
          amount: expectedAmount,
          status: 'สำเร็จ',
          method: 'Thai QR',
          slip_url: slipUrl // เก็บลิงก์เพื่อให้ลูกค้ากด "ดูสลิป" ย้อนหลังได้
        });

      return NextResponse.json({ 
        success: true, 
        message: 'ต่ออายุแพ็กเกจสำเร็จ',
        newEndDate: newEndDate.toISOString()
      });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }, { status: 500 });
  }
}