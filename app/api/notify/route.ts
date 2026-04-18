// src/app/api/notify/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    const token = process.env.LINE_BOT_ACCESS_TOKEN;
    const adminId = process.env.ADMIN_LINE_ID;

    if (!token || !adminId) {
      return NextResponse.json(
        { error: 'ตั้งค่า LINE_BOT_ACCESS_TOKEN หรือ ADMIN_LINE_ID ไม่ครบถ้วน' },
        { status: 500 }
      );
    }

    // ยิง Request แบบ Push Message ไปที่ LINE Messaging API
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: adminId, // ส่งหาแอดมิน (หรือกลุ่ม) ตาม ID ที่ตั้งไว้
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send Push Message');
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('LINE Bot Push Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}