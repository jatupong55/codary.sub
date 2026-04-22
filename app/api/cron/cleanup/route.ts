// src/app/api/cron/cleanup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendLineAdmin } from '@/lib/lineNotify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // --- Security Check ---
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
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
        .filter(sub => !sub.payments || (sub.payments as { status: string }[]).every((p) => p.status !== 'รอตรวจสอบ' && p.status !== 'pending'))
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
        console.log(`เคลียร์ออเดอร์ขยะสำเร็จ: ${abandonedCleared} รายการ`);
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
    
    // สร้าง Array เก็บรายชื่อคนที่ถูกเตะ
    const kickSummaryList: string[] = [];

    if (expiredNowSubs && expiredNowSubs.length > 0) {
      for (const sub of expiredNowSubs) {
        // 1. อัปเดต Database
        await supabaseAdmin
          .from('subscriptions')
          .update({ 
            status: 'expired',
            master_account_id: null 
          })
          .eq('id', sub.id);

        kickedCount++;

        // 2. เตรียมข้อมูลสรุป
        const isScheduledCancel = sub.details?.cancelAtPeriodEnd === true;
        const reason = isScheduledCancel ? 'ยกเลิกเมื่อหมดรอบบิล' : 'หมดอายุ';
        const brand = (sub.products as { name?: string } | null)?.name || 'ไม่ระบุ';
        const email = (sub.users as { email?: string } | null)?.email || 'ไม่ระบุอีเมล';
        const house = (sub.master_accounts as { email?: string } | null)?.email || 'ยังไม่จัดบ้าน';
        
        // ดันข้อความสั้นๆ เข้า Array
        kickSummaryList.push(`- ${email} | 🏠 ${house}\n  [${brand}] ${reason}`);
      }

      console.log(`🥾 เตะลูกค้าหมดอายุสำเร็จ: ${kickedCount} รายการ`);

      // 3. ส่ง LINE รวบยอด 1 ครั้ง หลังจบลูป
      if (kickSummaryList.length > 0) {
        const finalMessage = `🔴 [Auto-Kick Summary]\nระบบดำเนินการปลดโควตาลูกค้าจำนวน ${kickedCount} รายการ:\n----------------------\n${kickSummaryList.join('\n\n')}\n----------------------\n⚠️ แอดมินโปรดไปเตะออกจาก Family ในระบบจริงด้วยครับ!`;
        
        await sendLineAdmin(finalMessage);
      }
    }

    return NextResponse.json({
      success: true,
      summary: { abandonedCleared, usersKicked: kickedCount },
      message: 'Cronjob (Cleanup) ทำงานสำเร็จ!'
    });

  } catch (error: unknown) {
    console.error('Cron Cleanup Error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบเคลียร์บ้าน' }, { status: 500 });
  }
}