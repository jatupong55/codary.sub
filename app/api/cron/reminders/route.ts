// src/app/api/cron/remind/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { ReminderEmail } from '@/components/emails/ReminderEmail';
import { formatDate } from '@/utils/subscriptionUtils';
import { sendLineUser } from '@/lib/lineNotify';
import { sendWebPushToUser } from '@/lib/webPush';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // --- Security Check ---
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized: ระบุรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }

  try {
    const daysToNotify = parseInt(process.env.NOTIFY_BEFORE_DAYS || '3');
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToNotify);
    const targetDateString = targetDate.toISOString().split('T')[0];

    const { data: expiringSubs, error: expiringError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id, end_date, user_id,
        users ( email, display_name, line_user_id ),
        products ( name, price )
      `)
      .eq('status', 'active')
      .gte('end_date', `${targetDateString}T00:00:00.000Z`)
      .lte('end_date', `${targetDateString}T23:59:59.999Z`);

    if (expiringError) throw expiringError;

    const notificationsSent = [];

    if (expiringSubs && expiringSubs.length > 0) {
      for (const sub of expiringSubs) {
        const usersArr = sub.users as { email: string; display_name?: string | null }[] | null;
        const productsArr = sub.products as { name: string; price: number }[] | null;
        const user = usersArr?.[0];
        const product = productsArr?.[0];
        const userEmail = user?.email;
        const formattedDate = formatDate(sub.end_date);

        try {
          if (!userEmail || !product) throw new Error('Missing user or product data');

          await resend.emails.send({
            from: 'Codary Sub <onboarding@resend.dev>', 
            to: [userEmail], 
            subject: `แจ้งเตือนยอดชำระ: ${product.name}`,
            react: ReminderEmail({ 
              userName: user.display_name || user.email || 'ลูกค้า', 
              productName: product.name, 
              targetDateString: formattedDate, 
              price: product.price 
            }) as React.ReactElement,
          });
          
          // 2. ส่ง LINE (ถ้ามี Token)
          const lineUserId = (user as any).line_user_id;
          if (lineUserId) {
            const lineMessage = `📢 แจ้งเตือนจาก Codary Sub!\n------------------\n🛍️ แพ็กเกจ: ${product.name}\n📅 จะหมดอายุในวันที่: ${formattedDate}\n💰 ยอดชำระ: ฿${product.price}\n------------------\nโปรดตรวจสอบข้อมูลในหน้า Dashboard เพื่อดำเนินการต่ออายุครับ 😊`;
            await sendLineUser(lineUserId, lineMessage);
            console.log(`✅ ส่ง LINE สำเร็จ -> ${userEmail}`);
          }

          // 3. ส่ง Web Push Notification
          if (sub.user_id) {
            await sendWebPushToUser(sub.user_id, {
              title: `แพ็กเกจ ${product.name} ใกล้หมดอายุ ⏳`,
              body: `แพ็กเกจของคุณจะหมดอายุในวันที่ ${formattedDate} โปรดต่ออายุเพื่อใช้งานอย่างต่อเนื่อง`
            });
            console.log(`✅ ส่ง Web Push สำเร็จ -> ${userEmail}`);
          }

          notificationsSent.push(userEmail);
        } catch (emailError) {
          console.error(`❌ แจ้งเตือนพลาด -> ${userEmail}:`, emailError);
        }
      }

      // อัปเดตสถานะใน Database เป็น expiring_soon
      const subIds = expiringSubs.map(s => s.id);
      if (subIds.length > 0) {
        await supabaseAdmin.from('subscriptions').update({ status: 'expiring_soon' }).in('id', subIds);
      }
    }

    return NextResponse.json({
      success: true,
      summary: { emailsSent: notificationsSent.length },
      message: 'Cronjob (Remind) ทำงานสำเร็จ!'
    });

  } catch (error: unknown) {
    console.error('Cron Remind Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบแจ้งเตือนอีเมล' }, { status: 500 });
  }
}