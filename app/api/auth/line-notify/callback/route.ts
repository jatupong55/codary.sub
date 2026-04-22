// app/api/auth/line-notify/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // state คือ userId ของเรา

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=line_auth_failed', request.url));
  }

  try {
    // 1. แลก Code เป็น Access Token
    const response = await fetch('https://notify-bot.line.me/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINE_NOTIFY_REDIRECT_URI!,
        client_id: process.env.LINE_NOTIFY_CLIENT_ID!,
        client_secret: process.env.LINE_NOTIFY_CLIENT_SECRET!,
      }),
    });

    const data = await response.json();

    if (data.status !== 200) {
      throw new Error(data.message || 'Failed to exchange token');
    }

    // 2. บันทึก Token ลงในตาราง users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ line_notify_token: data.access_token })
      .eq('id', state);

    if (updateError) throw updateError;

    // 3. ส่งกลับไปหน้า Dashboard พร้อมแจ้งเตือนสำเร็จ
    return NextResponse.redirect(new URL('/dashboard?line_notify=success', request.url));

  } catch (error) {
    console.error('LINE Notify Error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=line_token_error', request.url));
  }
}
