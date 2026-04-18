// src/app/api/cron/cleanup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- ฟังก์ชันยิง LINE แจ้งเตือนแอดมิน ---
const notifyAdminLine = async (message: string) => {
  const token = process.env.LINE_BOT_ACCESS_TOKEN;
  const adminId = process.env.ADMIN_LINE_ID;
  if (!token || !adminId) return;

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: adminId,
        messages: [{ type: 'text', text: message }]
      }),
    });
  } catch (error) {
    console.error('Failed to send Line notification:', error);
  }
};

export async function GET(request: Request) {
  // --- Security Check ---
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized: ระบุรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }

  try {
    // ==========================================
    // ภารกิจที่ 1: เคลียร์ออเดอร์ขยะ (Pending เกิน 24 ชั่วโมง)
    // ==========================================
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: abandonedSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('id, payments(status)')
      .eq('status', 'pending')
      .lt('created_at', yesterday);

    let abandonedCleared = 0;

    if (abandonedSubs) {
      const subsToDelete = abandonedSubs
        .filter(sub => !sub.payments || sub.payments.every((p: any) => p.status !== 'รอตรวจสอบ' && p.status !== 'pending'))
        .map(sub => sub.id);

      if (subsToDelete.length > 0) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ 
            status: 'cancelled', 
            details: { cancelReason: 'ระบบยกเลิกอัตโนมัติ (ไม่ชำระเงินใน 24 ชม.)' } 
          })
          .in('id', subsToDelete);
        
        abandonedCleared = subsToDelete.length;
        console.log(`🧹 เคลียร์ออเดอร์ขยะสำเร็จ: ${abandonedCleared} รายการ`);
      }
    }

    // ==========================================
    // ภารกิจที่ 2: เตะลูกค้าที่หมดอายุ / ถึงเวลายกเลิก
    // ==========================================
    const nowString = new Date().toISOString();
    
    const { data: expiredNowSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('id, end_date, details, status, users(email), products(name), master_accounts(email)')
      .in('status', ['active', 'expiring_soon'])
      .lte('end_date', nowString);

    let kickedCount = 0;

    if (expiredNowSubs && expiredNowSubs.length > 0) {
      for (const sub of expiredNowSubs) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ 
            status: 'expired',
            master_account_id: null 
          })
          .eq('id', sub.id);

        kickedCount++;

        const isScheduledCancel = sub.details?.cancelAtPeriodEnd === true;
        const reason = isScheduledCancel ? 'ลูกค้าระบุขอยกเลิกเมื่อหมดรอบบิล' : 'หมดอายุแพ็กเกจ (ไม่ต่ออายุ)';
        
        const alertMessage = `🔴 [Auto-Kick] นำลูกค้าออกจากระบบ\n----------------------\n🛍️ แบรนด์: ${(sub.products as any)?.name}\n🏠 บ้าน: ${(sub.master_accounts as any)?.email || 'ยังไม่จัดบ้าน'}\n👤 ลูกค้า: ${(sub.users as any)?.email}\n📄 เหตุผล: ${reason}\n----------------------\n⚠️ ระบบปลดโควตาบนเว็บแล้ว แอดมินโปรดไปเตะออกในระบบจริงด้วยครับ!`;
        
        await notifyAdminLine(alertMessage);
      }
      console.log(`🥾 เตะลูกค้าหมดอายุสำเร็จ: ${kickedCount} รายการ`);
    }

    return NextResponse.json({
      success: true,
      summary: { abandonedCleared, usersKicked: kickedCount },
      message: 'Cronjob (Cleanup) ทำงานสำเร็จ!'
    });

  } catch (error: any) {
    console.error('Cron Cleanup Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบเคลียร์บ้าน' }, { status: 500 });
  }
}