import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { ReminderEmail } from '@/components/emails/ReminderEmail'; // ✨ 1. ดึง Template ใบเสร็จมาใช้

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY); // ✨ 2. เตรียมระบบยิงเมล

export async function GET(request: Request) {
  // --- Security Check ---
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized: ระบุรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }

  try {
    // --- ตั้งค่าวันที่ (ดึงจาก .env หรือใช้ 3 วันเป็นค่าพื้นฐาน) ---
    const daysToNotify = parseInt(process.env.NOTIFY_BEFORE_DAYS || '3');
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToNotify);
    const targetDateString = targetDate.toISOString().split('T')[0];

    // --- ค้นหาลูกค้าที่ใกล้หมดอายุ ---
    const { data: expiringSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id, end_date, user_id,
        users ( email, display_name ),
        products ( name, price )
      `)
      .eq('status', 'active')
      .gte('end_date', `${targetDateString}T00:00:00.000Z`)
      .lte('end_date', `${targetDateString}T23:59:59.999Z`);

    if (error) throw error;

    if (!expiringSubs || expiringSubs.length === 0) {
      return NextResponse.json({ success: true, message: 'ไม่มีแพ็กเกจที่ต้องแจ้งเตือนในวันนี้' });
    }

    const notificationsSent = [];

    // --- วนลูปยิง Email ---
    for (const sub of expiringSubs) {
      const user = sub.users as any;
      const product = sub.products as any;
      
      const userEmail = user.email;
      // จัด Format วันที่ให้สวยงามแบบไทย (เช่น 26 เม.ย. 2569)
      const formattedDate = new Date(sub.end_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

      try {
        // 3. ส่ง Email จริงผ่าน Resend พร้อมยัดข้อมูลลง Template
        await resend.emails.send({
          // ถ้าบอสยังไม่ได้ยืนยัน Domain ในเว็บ Resend บรรทัดนี้ต้องเปลี่ยนเป็น 'onboarding@resend.dev' 
          // และ 'to' ต้องเป็นอีเมลที่ใช้สมัคร Resend เท่านั้น (สำหรับใช้ตอน Test)
          from: 'Codary Sub <onboarding@resend.dev>', 
          to: [userEmail], 
          subject: `แจ้งเตือนยอดชำระ: ${product.name}`,
          react: ReminderEmail({ 
            userName: user.display_name, 
            productName: product.name, 
            targetDateString: formattedDate, 
            price: product.price 
          }) as React.ReactElement,
        });
        
        console.log(`✅ ยิง Email สำเร็จ -> ${userEmail}`);
        notificationsSent.push(userEmail);

      } catch (emailError) {
        console.error(`❌ ยิง Email พลาด -> ${userEmail}:`, emailError);
      }
    }

    // --- อัปเดตสถานะใน Database เป็น expiring_soon ---
    const subIds = expiringSubs.map(s => s.id);
    if (subIds.length > 0) {
      await supabaseAdmin.from('subscriptions').update({ status: 'expiring_soon' }).in('id', subIds);
    }

    return NextResponse.json({
      success: true,
      message: `ดำเนินการแจ้งเตือนสำเร็จจำนวน ${notificationsSent.length} รายการ`,
      notifiedUsers: notificationsSent
    });

  } catch (error: any) {
    console.error('Cron System Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบอัตโนมัติ' }, { status: 500 });
  }
}