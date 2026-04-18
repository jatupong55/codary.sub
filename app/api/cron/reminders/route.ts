// src/app/api/cron/remind/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { ReminderEmail } from '@/components/emails/ReminderEmail';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // --- Security Check ---
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
        users ( email, display_name ),
        products ( name, price )
      `)
      .eq('status', 'active')
      .gte('end_date', `${targetDateString}T00:00:00.000Z`)
      .lte('end_date', `${targetDateString}T23:59:59.999Z`);

    if (expiringError) throw expiringError;

    const notificationsSent = [];

    if (expiringSubs && expiringSubs.length > 0) {
      for (const sub of expiringSubs) {
        const user = sub.users as any;
        const product = sub.products as any;
        const userEmail = user.email;
        const formattedDate = new Date(sub.end_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

        try {
          await resend.emails.send({
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

  } catch (error: any) {
    console.error('Cron Remind Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบแจ้งเตือนอีเมล' }, { status: 500 });
  }
}