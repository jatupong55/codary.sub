// app/api/auth/line/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId ของเรา

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=line_auth_failed', request.url));
  }

  try {
    // 1. แลก Code เป็น Access Token & ID Token
    const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.NEXT_PUBLIC_LINE_LOGIN_REDIRECT_URI!,
        client_id: process.env.NEXT_PUBLIC_LINE_LOGIN_CLIENT_ID!,
        client_secret: process.env.LINE_LOGIN_CLIENT_SECRET!,
      }),
    });

    const data = await response.json();
    
    // 2. แกะ ID Token เพื่อเอา userId ของ LINE
    const decoded: any = jwt.decode(data.id_token);
    const lineUserId = decoded.sub;

    if (!lineUserId) {
      throw new Error('Could not get LINE User ID');
    }

    // 3. บันทึกลงในตาราง users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ line_user_id: lineUserId })
      .eq('id', state);

    if (updateError) throw updateError;

    return NextResponse.redirect(new URL('/dashboard?line_auth=success', request.url));

  } catch (error) {
    console.error('LINE Login Error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=line_token_error', request.url));
  }
}
