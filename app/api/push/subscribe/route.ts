import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, subscription } = body;

    if (!userId || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // บันทึก Token ลงฐานข้อมูล
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('Database Error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push Subscribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
