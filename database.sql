-- ==============================================================================
-- Codary Sub - Database Schema for Supabase
-- วิธีใช้งาน: คัดลอกโค้ดทั้งหมดนี้ไปรันใน SQL Editor ของ Supabase Project ของคุณ
-- ==============================================================================

-- เปิดใช้งาน UUID extension (ถ้ายังไม่ได้เปิด)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- สำหรับ gen_random_uuid()

-- 1. สร้างตาราง Users (ไม่มี Dependencies)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  line_user_id text UNIQUE,
  email text,
  display_name text,
  notification jsonb DEFAULT '{"line": true, "email": true}'::jsonb,
  role text DEFAULT 'user'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- 2. สร้างตาราง Products (ไม่มี Dependencies)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL,
  max_slots integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  icon text,
  bg_color text DEFAULT '#f3f4f6'::text,
  description text,
  is_active boolean DEFAULT true,
  yearly_price numeric,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- 3. สร้างตาราง Admin Menus (ไม่มี Dependencies)
CREATE SEQUENCE IF NOT EXISTS public.admin_menus_id_seq;

CREATE TABLE IF NOT EXISTS public.admin_menus (
  id integer NOT NULL DEFAULT nextval('admin_menus_id_seq'::regclass),
  name text NOT NULL,
  path text NOT NULL,
  icon text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT admin_menus_pkey PRIMARY KEY (id)
);

-- 4. สร้างตาราง Master Accounts (อ้างอิง products)
CREATE TABLE IF NOT EXISTS public.master_accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  email text NOT NULL,
  password text,
  max_slots integer NOT NULL DEFAULT 6,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  details jsonb DEFAULT '{}'::jsonb,
  next_renewal_date date,
  cost numeric NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly'::text CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  CONSTRAINT master_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT master_accounts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- 5. สร้างตาราง Subscriptions (อ้างอิง users, products, master_accounts)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  product_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  master_account_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  billing_cycle text DEFAULT 'monthly'::text,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT subscriptions_master_account_id_fkey FOREIGN KEY (master_account_id) REFERENCES public.master_accounts(id)
);

-- 6. สร้างตาราง Payments (อ้างอิง subscriptions, users)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  user_id uuid,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'สำเร็จ'::text,
  method text DEFAULT 'Thai QR'::text,
  slip_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id),
  CONSTRAINT fk_payments_users FOREIGN KEY (user_id) REFERENCES public.users(id)
  -- หมายเหตุ: ตัด CONSTRAINT user_id_fkey REFERENCES auth.users(id) ออกเพื่อหลีกเลี่ยง Error หากผู้ใช้ไม่ได้ใช้ Supabase Auth
);

-- 7. สร้างตาราง License Vault (อ้างอิง subscriptions, products)
CREATE TABLE IF NOT EXISTS public.license_vault (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subscription_id uuid,
  encrypted_key text,
  status text DEFAULT 'available'::text,
  created_at timestamp with time zone DEFAULT now(),
  product_id uuid,
  license_key text,
  CONSTRAINT license_vault_pkey PRIMARY KEY (id),
  CONSTRAINT ms365_vault_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id),
  CONSTRAINT license_vault_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- 8. สร้างตาราง Push Subscriptions (อ้างอิง users)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 9. สร้างตาราง Transactions (อ้างอิง users)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  amount numeric NOT NULL,
  slipok_ref text UNIQUE,
  slip_image_url text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
