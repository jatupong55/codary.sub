import { createClient } from '@supabase/supabase-js'

// ดึงค่าจากไฟล์ .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// สร้างตัวเชื่อมต่อ Database
export const supabase = createClient(supabaseUrl, supabaseAnonKey)