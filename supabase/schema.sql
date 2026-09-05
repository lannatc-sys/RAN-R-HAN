-- =====================================================================
-- RAB-R-HAN (รับ-อาหาร) DATABASE SCHEMA & RLS POLICIES
-- Multi-tenant Restaurant SaaS (QR Ordering + POS)
-- Designed for Supabase (PostgreSQL 15+)
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS (UPDATED_AT)
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 3. ENUMS & DOMAINS
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('superadmin', 'owner', 'staff');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE shop_status AS ENUM ('active', 'suspended', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE vat_mode AS ENUM ('none', 'inclusive', 'exclusive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'cooking', 'served', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('promptpay', 'cash', 'credit_card', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'rejected', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================================
-- 4. CORE TABLES
-- =====================================================================

-- 4.1 SHOPS (ข้อมูลร้านค้า - Tenant แม่)
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo TEXT,
    promptpay_id TEXT, -- เบอร์โทรศัพท์ หรือ เลขบัตรประชาชน / เลขผู้เสียภาษี
    promptpay_name TEXT, -- ชื่อบัญชีพร้อมเพย์สำหรับตรวจสอบ
    plan TEXT NOT NULL DEFAULT 'standard', -- trial | standard (199.-/mo) | pro
    status shop_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    service_charge NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- เปอร์เซ็นต์ เช่น 10.00 = 10%
    vat_mode vat_mode NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Slug resolution in Public Menu (/menu/[slug])
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);

-- 4.2 USERS (ผู้ใช้งานระบบ เชื่อมกับ Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'staff',
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_shop_id ON public.users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 4.3 CATEGORIES (หมวดหมู่อาหาร)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_shop ON public.categories(shop_id, sort_order ASC);

-- 4.4 MENU_ITEMS (รายการอาหาร)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_shop ON public.menu_items(shop_id, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

-- 4.5 OPTIONS (ตัวเลือกเสริม / ท็อปปิ้ง เช่น เผ็ดน้อย, พิเศษ, ไข่ดาว)
CREATE TABLE IF NOT EXISTS public.options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_options_menu_item ON public.options(menu_item_id);

-- 4.6 TABLES (โต๊ะในร้าน & QR Code Token)
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    table_no TEXT NOT NULL,
    qr_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    status table_status NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_shop_table_no UNIQUE (shop_id, table_no)
);

CREATE INDEX IF NOT EXISTS idx_tables_shop ON public.tables(shop_id);
CREATE INDEX IF NOT EXISTS idx_tables_qr_token ON public.tables(qr_token);

-- 4.7 ORDERS (ออร์เดอร์สั่งอาหาร)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    order_no TEXT NOT NULL, -- เช่น #001 ประจำวัน หรือ รหัสออร์เดอร์
    type order_type NOT NULL DEFAULT 'dine_in',
    status order_status NOT NULL DEFAULT 'pending',
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    note TEXT,
    customer_phone TEXT,
    pickup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_shop ON public.orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(shop_id, status);

-- 4.8 ORDER_ITEMS (รายการอาหารในแต่ละออร์เดอร์ - เก็บ Snapshot)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    name_snapshot TEXT NOT NULL,
    price_snapshot NUMERIC(10, 2) NOT NULL CHECK (price_snapshot >= 0),
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    options_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ "name": "ไข่ดาว", "price_delta": 10 }]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 4.9 PAYMENTS (การชำระเงิน และ แนบสลิป)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE, -- Denormalized เพื่อความเร็วในการค้นหาและ RLS
    method payment_method NOT NULL DEFAULT 'promptpay',
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    ref TEXT, -- เลขอ้างอิงสลิป / สลิปโอเค
    slip_url TEXT, -- รูปสลิปโอนเงิน (Supabase Storage)
    verified_at TIMESTAMPTZ,
    status payment_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop ON public.payments(shop_id, status);

-- =====================================================================
-- 5. ATTACH UPDATED_AT TRIGGERS
-- =====================================================================

DROP TRIGGER IF EXISTS trg_shops_updated_at ON public.shops;
CREATE TRIGGER trg_shops_updated_at BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_options_updated_at ON public.options;
CREATE TRIGGER trg_options_updated_at BEFORE UPDATE ON public.options
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tables_updated_at ON public.tables;
CREATE TRIGGER trg_tables_updated_at BEFORE UPDATE ON public.tables
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 6. ORDER NUMBER GENERATOR (รันเลขที่ออร์เดอร์ประจำวันของแต่ละร้าน เช่น #001)
-- =====================================================================

CREATE OR REPLACE FUNCTION generate_daily_order_no()
RETURNS TRIGGER AS $$
DECLARE
    today_start TIMESTAMPTZ := date_trunc('day', NOW());
    today_count INTEGER;
BEGIN
    IF NEW.order_no IS NULL OR NEW.order_no = '' THEN
        SELECT COUNT(*) + 1 INTO today_count
        FROM public.orders
        WHERE shop_id = NEW.shop_id
          AND created_at >= today_start;

        NEW.order_no := '#' || LPAD(today_count::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_order_no ON public.orders;
CREATE TRIGGER trg_orders_order_no BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION generate_daily_order_no();

-- =====================================================================
-- 7. SECURITY DEFINER FUNCTIONS FOR RLS (No recursion)
-- =====================================================================

-- Get Current User Profile from Public Users
CREATE OR REPLACE FUNCTION public.get_auth_user()
RETURNS TABLE (
    user_id UUID,
    shop_id UUID,
    role user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, shop_id, role
    FROM public.users
    WHERE id = auth.uid();
$$;

-- Check if Current User is Superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'superadmin'
    );
$$;

-- Check if Current User has Access to a Specific Shop
CREATE OR REPLACE FUNCTION public.has_shop_access(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND (role = 'superadmin' OR shop_id = target_shop_id)
    );
$$;

-- Check if Current User is Owner of a Specific Shop
CREATE OR REPLACE FUNCTION public.is_shop_owner(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND (role = 'superadmin' OR (shop_id = target_shop_id AND role = 'owner'))
    );
$$;

-- =====================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 8.1 SHOPS POLICIES
-- ---------------------------------------------------------------------

-- Public: อ่านข้อมูลร้านค้าได้เฉพาะร้านที่ active (สำหรับหน้าเมนูลูกค้า)
CREATE POLICY "Public can view active shop profile"
ON public.shops
FOR SELECT
TO public, anon, authenticated
USING (status = 'active');

-- Staff/Owner: ดูข้อมูลร้านตัวเองได้ (รวมถึงตอน expired เพื่อดูหน้าแจ้งเตือน)
CREATE POLICY "Shop staff and owner can view their shop"
ON public.shops
FOR SELECT
TO authenticated
USING (public.has_shop_access(id));

-- Owner: อัปเดตข้อมูลร้านตัวเองได้ (PromptPay, Service charge, Vat mode ฯลฯ ยกเว้น plan/expires_at)
CREATE POLICY "Owner can update their shop profile"
ON public.shops
FOR UPDATE
TO authenticated
USING (public.is_shop_owner(id))
WITH CHECK (public.is_shop_owner(id));

-- Superadmin: จัดการร้านค้าได้ทั้งหมด (Full CRUD)
CREATE POLICY "Superadmin can manage all shops"
ON public.shops
FOR ALL
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- ---------------------------------------------------------------------
-- 8.2 USERS POLICIES
-- ---------------------------------------------------------------------

-- อ่านข้อมูล Profile ตัวเอง
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_superadmin());

-- Owner: ดูรายชื่อ staff ในร้านตัวเองได้
CREATE POLICY "Owner can view shop staff"
ON public.users
FOR SELECT
TO authenticated
USING (public.is_shop_owner(shop_id));

-- Owner: จัดการ staff ในร้านตัวเองได้
CREATE POLICY "Owner can insert staff in their shop"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (public.is_shop_owner(shop_id) AND role = 'staff');

CREATE POLICY "Owner can update staff in their shop"
ON public.users
FOR UPDATE
TO authenticated
USING (public.is_shop_owner(shop_id) AND role = 'staff')
WITH CHECK (public.is_shop_owner(shop_id) AND role = 'staff');

CREATE POLICY "Owner can delete staff in their shop"
ON public.users
FOR DELETE
TO authenticated
USING (public.is_shop_owner(shop_id) AND role = 'staff');

-- Superadmin: จัดการ users ทั้งหมดได้
CREATE POLICY "Superadmin can manage all users"
ON public.users
FOR ALL
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- ---------------------------------------------------------------------
-- 8.3 CATEGORIES POLICIES
-- ---------------------------------------------------------------------

-- Public / Customer: ดูหมวดหมู่ของร้านค้าได้
CREATE POLICY "Public can view categories of active shops"
ON public.categories
FOR SELECT
TO public, anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = categories.shop_id AND s.status = 'active'
    )
);

-- Staff/Owner: จัดการหมวดหมู่ในร้านตัวเอง
CREATE POLICY "Staff and Owner can manage shop categories"
ON public.categories
FOR ALL
TO authenticated
USING (public.has_shop_access(shop_id))
WITH CHECK (public.has_shop_access(shop_id));

-- ---------------------------------------------------------------------
-- 8.4 MENU_ITEMS POLICIES
-- ---------------------------------------------------------------------

-- Public / Customer: ดูเมนูอาหารของร้านได้
CREATE POLICY "Public can view menu items of active shops"
ON public.menu_items
FOR SELECT
TO public, anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = menu_items.shop_id AND s.status = 'active'
    )
);

-- Staff/Owner: จัดการเมนูอาหารในร้านตัวเอง (เพิ่ม/ลบ/แก้ไข/เปิด-ปิดการขาย)
CREATE POLICY "Staff and Owner can manage shop menu items"
ON public.menu_items
FOR ALL
TO authenticated
USING (public.has_shop_access(shop_id))
WITH CHECK (public.has_shop_access(shop_id));

-- ---------------------------------------------------------------------
-- 8.5 OPTIONS POLICIES
-- ---------------------------------------------------------------------

-- Public / Customer: ดูตัวเลือกเสริมของเมนูอาหารได้
CREATE POLICY "Public can view menu item options"
ON public.options
FOR SELECT
TO public, anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.menu_items m
        JOIN public.shops s ON s.id = m.shop_id
        WHERE m.id = options.menu_item_id AND s.status = 'active'
    )
);

-- Staff/Owner: จัดการตัวเลือกเสริมในเมนูของร้านตัวเอง
CREATE POLICY "Staff and Owner can manage menu item options"
ON public.options
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.menu_items m
        WHERE m.id = options.menu_item_id AND public.has_shop_access(m.shop_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.menu_items m
        WHERE m.id = options.menu_item_id AND public.has_shop_access(m.shop_id)
    )
);

-- ---------------------------------------------------------------------
-- 8.6 TABLES POLICIES
-- ---------------------------------------------------------------------

-- Public / Customer: ดูข้อมูลโต๊ะผ่าน qr_token (ตรวจสอบความถูกต้องตอนสแกน)
CREATE POLICY "Public can verify table via qr_token"
ON public.tables
FOR SELECT
TO public, anon, authenticated
USING (true); -- ตรวจสอบผ่าน WHERE qr_token = '...' ใน query

-- Staff/Owner: จัดการโต๊ะทั้งหมดในร้านตัวเอง
CREATE POLICY "Staff and Owner can manage shop tables"
ON public.tables
FOR ALL
TO authenticated
USING (public.has_shop_access(shop_id))
WITH CHECK (public.has_shop_access(shop_id));

-- ---------------------------------------------------------------------
-- 8.7 ORDERS POLICIES
-- ---------------------------------------------------------------------

-- Customer (Anon/Public): สั่งอาหารได้ (Insert order)
CREATE POLICY "Customer can create order"
ON public.orders
FOR INSERT
TO public, anon, authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = orders.shop_id AND s.status = 'active'
    )
);

-- Customer: อ่านสถานะออร์เดอร์ตัวเองได้ (อ่านจาก order_id)
CREATE POLICY "Customer can view their own order"
ON public.orders
FOR SELECT
TO public, anon, authenticated
USING (true);

-- Staff/Owner: ดูและจัดการออร์เดอร์ทั้งหมดในร้านตัวเอง (POS / Kitchen Display)
CREATE POLICY "Staff and Owner can view and manage shop orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.has_shop_access(shop_id))
WITH CHECK (public.has_shop_access(shop_id));

-- ---------------------------------------------------------------------
-- 8.8 ORDER_ITEMS POLICIES
-- ---------------------------------------------------------------------

-- Customer: ส่งรายการอาหารในออร์เดอร์ (Insert)
CREATE POLICY "Customer can insert order items"
ON public.order_items
FOR INSERT
TO public, anon, authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
    )
);

-- Customer: ดูรายการอาหารในออร์เดอร์
CREATE POLICY "Customer can view order items"
ON public.order_items
FOR SELECT
TO public, anon, authenticated
USING (true);

-- Staff/Owner: จัดการ order_items ในร้านตัวเอง
CREATE POLICY "Staff and Owner can manage order items"
ON public.order_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND public.has_shop_access(o.shop_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND public.has_shop_access(o.shop_id)
    )
);

-- ---------------------------------------------------------------------
-- 8.9 PAYMENTS POLICIES
-- ---------------------------------------------------------------------

-- Customer: สร้างรายการแจ้งชำระเงินและแนบสลิป
CREATE POLICY "Customer can create payment"
ON public.payments
FOR INSERT
TO public, anon, authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = payments.order_id AND o.shop_id = payments.shop_id
    )
);

-- Customer: ตรวจสอบสถานะการชำระเงินของออร์เดอร์ตนเอง
CREATE POLICY "Customer can view payment status"
ON public.payments
FOR SELECT
TO public, anon, authenticated
USING (true);

-- Staff/Owner: ดูและอัปเดตสถานะการชำระเงิน (ยืนยันสลิป / รับเงินสด)
CREATE POLICY "Staff and Owner can view and update shop payments"
ON public.payments
FOR ALL
TO authenticated
USING (public.has_shop_access(shop_id))
WITH CHECK (public.has_shop_access(shop_id));

-- =====================================================================
-- 9. SUPABASE REALTIME ENABLEMENT
-- =====================================================================
-- เปิด Realtime สำหรับหน้า POS, Kitchen Display, และสถานะออร์เดอร์ลูกค้า
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================================
-- 10. SUPABASE STORAGE BUCKETS CONFIGURATION
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('menu-images', 'menu-images', true),
    ('shop-logos', 'shop-logos', true),
    ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for menu-images
CREATE POLICY "Menu images are publicly accessible"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'menu-images');

CREATE POLICY "Shop staff can upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

CREATE POLICY "Shop staff can update and delete menu images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'menu-images');

-- Storage Policies for shop-logos
CREATE POLICY "Shop logos are publicly accessible"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'shop-logos');

CREATE POLICY "Shop owners can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shop-logos');

CREATE POLICY "Shop owners can update and delete logos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'shop-logos');

-- Storage Policies for payment-slips
CREATE POLICY "Payment slips can be uploaded by customer"
ON storage.objects FOR INSERT
TO public, anon, authenticated
WITH CHECK (bucket_id = 'payment-slips');

CREATE POLICY "Payment slips can be viewed by shop staff"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'payment-slips');
