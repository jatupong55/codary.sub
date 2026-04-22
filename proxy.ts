// proxy.ts
// Next.js 16: ไฟล์ middleware ถูก rename เป็น proxy.ts
//
// ⚠️ หมายเหตุ:
// ไม่ได้ทำ route guard ที่นี่เพราะ @supabase/supabase-js เก็บ session ใน localStorage
// ซึ่ง server-side proxy ไม่สามารถอ่านได้
//
// การป้องกัน route ทำผ่าน useEffect ในแต่ละ page แทน
// หากต้องการ server-side guard ในอนาคต ต้อง migrate ไปใช้ @supabase/ssr

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(_request: NextRequest) {
  // Pass-through: ไม่ block ทุก request ผ่านได้ตามปกติ
  return NextResponse.next();
}
