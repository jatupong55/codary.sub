import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ใช้ฟังก์ชัน GET เพื่อให้ระบบ Cron สามารถเรียกใช้ URL นี้ได้ง่าย
export async function GET(request: Request) {
  try {
    // 1. คำนวณหาวันที่เป้าหมาย (เช่น อีก 3 วันข้างหน้า)
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 3);
    const targetDateString = targetDate.toISOString().split('T')[0];

    // 2. ค้นหาแพ็กเกจที่มีสถานะ active และมีวันหมดอายุตรงกับเป้าหมาย
    const { data: expiringSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id,
        end_date,
        user_id,
        users ( email, display_name ),
        products ( name, price )
      `)
      .eq('status', 'active')
      .eq('end_date', targetDateString);

    if (error) throw error;

    if (!expiringSubs || expiringSubs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'ไม่มีแพ็กเกจที่ต้องแจ้งเตือนในวันนี้' 
      });
    }

    const notificationsSent = [];

    // 3. วนลูปเพื่อส่งการแจ้งเตือนให้ลูกค้าแต่ละคน
    for (const sub of expiringSubs) {
      const user = sub.users as any;
      const product = sub.products as any;
      
      const userEmail = user.email;
      const userName = user.display_name;
      const productName = product.name;
      const price = product.price;

      // ในส่วนนี้เราจะใช้ Console.log เพื่อจำลองการส่ง Email 
      // (ในอนาคตคุณสามารถนำ Library อย่าง Resend หรือ Nodemailer มาใส่ตรงนี้ได้เลย)
      console.log('----------------------------------------');
      console.log(`[Email Sent] To: ${userEmail}`);
      console.log(`Subject: แจ้งเตือนต่ออายุแพ็กเกจ ${productName}`);
      console.log(`Body: สวัสดีคุณ ${userName}, แพ็กเกจ ${productName} ของคุณกำลังจะหมดอายุในวันที่ ${targetDateString} (ยอดชำระ ${price} บาท) กรุณาเข้าสู่ระบบ Codary Sub เพื่อต่ออายุการใช้งานครับ`);
      console.log('----------------------------------------');

      notificationsSent.push(userEmail);
    }

    // 4. อัปเดตสถานะในฐานข้อมูลเป็น expiring_soon เพื่อให้ UI หน้าเว็บเปลี่ยนสถานะ
    const subIds = expiringSubs.map(s => s.id);
    if (subIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'expiring_soon' })
        .in('id', subIds);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: `ดำเนินการแจ้งเตือนและอัปเดตสถานะสำเร็จจำนวน ${notificationsSent.length} รายการ`,
      notifiedUsers: notificationsSent
    });

  } catch (error: any) {
    console.error('Cron System Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบอัตโนมัติ' }, { status: 500 });
  }
}