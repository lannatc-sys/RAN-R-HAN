-- ==============================================================================
-- Rab-R-HAN (รับอาหาร) Multi-tenant SaaS Restaurant Platform
-- Migration 01: Initial Schema, Indexes, Triggers, Realtime & Storage
-- Compatible with Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Custom Types & Enums
do $$ begin
    create type public.shop_status as enum ('active', 'suspended', 'expired');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.user_role as enum ('superadmin', 'owner', 'staff');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.vat_mode as enum ('none', 'inclusive', 'exclusive');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.table_status as enum ('available', 'occupied', 'reserved');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.order_type as enum ('dine_in', 'takeaway');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.order_status as enum ('pending', 'confirmed', 'cooking', 'served', 'completed', 'cancelled');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.order_item_status as enum ('pending', 'cooking', 'served', 'cancelled');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.payment_method as enum ('promptpay', 'cash');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.payment_status as enum ('pending', 'verified', 'rejected');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.signup_source as enum ('friend', 'facebook', 'sales', 'other');
exception
    when duplicate_object then null;
end $$;

-- 3. Utility Function: Automatic updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- 4. Tables Definition
-- ==============================================================================

-- 4.1 shops: ข้อมูลร้านอาหาร (Multi-tenant Root)
create table if not exists public.shops (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    logo_url text,
    phone text,
    address text,
    promptpay_id text,
    promptpay_name text,
    plan text not null default 'basic',
    status public.shop_status not null default 'active',
    is_active boolean not null default true,
    expires_at timestamptz,
    plan_expires_at timestamptz,
    service_charge numeric(5, 2) not null default 0.00 check (service_charge >= 0),
    vat_mode public.vat_mode not null default 'none',
    referral_code text unique,
    referred_by text,
    signup_source public.signup_source not null default 'other',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_shops_updated_at
    before update on public.shops
    for each row execute function public.handle_updated_at();

-- 4.2 users: ข้อมูลผู้ใช้ในระบบ เชื่อมกับ Supabase Auth
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    shop_id uuid references public.shops(id) on delete cascade,
    role public.user_role not null default 'owner',
    full_name text,
    phone text,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_users_updated_at
    before update on public.users
    for each row execute function public.handle_updated_at();

-- 4.3 categories: หมวดหมู่อาหารของแต่ละร้าน
create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    name text not null,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_categories_updated_at
    before update on public.categories
    for each row execute function public.handle_updated_at();

-- 4.4 menu_items: รายการอาหาร
create table if not exists public.menu_items (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    category_id uuid references public.categories(id) on delete set null,
    name text not null,
    description text,
    price numeric(10, 2) not null check (price >= 0),
    image_url text,
    is_available boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_menu_items_updated_at
    before update on public.menu_items
    for each row execute function public.handle_updated_at();

-- 4.5 options: ตัวเลือกเสริมของเมนู (เช่น พิเศษ / ไข่ดาว / เผ็ดน้อย)
create table if not exists public.options (
    id uuid primary key default gen_random_uuid(),
    menu_item_id uuid not null references public.menu_items(id) on delete cascade,
    name text not null,
    price_delta numeric(10, 2) not null default 0.00,
    is_available boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_options_updated_at
    before update on public.options
    for each row execute function public.handle_updated_at();

-- 4.6 tables: โต๊ะอาหารและ QR Code ประจำโต๊ะ
create table if not exists public.tables (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    table_no text not null,
    qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
    status public.table_status not null default 'available',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint uq_shop_table_no unique (shop_id, table_no)
);

create trigger trg_tables_updated_at
    before update on public.tables
    for each row execute function public.handle_updated_at();

-- 4.7 orders: รายการคำสั่งซื้อ
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    table_id uuid references public.tables(id) on delete set null,
    order_no text not null,
    type public.order_type not null default 'dine_in',
    status public.order_status not null default 'pending',
    subtotal numeric(10, 2) not null default 0.00 check (subtotal >= 0),
    service_charge_amount numeric(10, 2) not null default 0.00 check (service_charge_amount >= 0),
    vat_amount numeric(10, 2) not null default 0.00 check (vat_amount >= 0),
    total numeric(10, 2) not null default 0.00 check (total >= 0),
    note text,
    customer_phone text,
    pickup_at timestamptz,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_orders_updated_at
    before update on public.orders
    for each row execute function public.handle_updated_at();

-- 4.8 order_items: รายการอาหารในคำสั่งซื้อ (Snapshot ราคาและตัวเลือก)
create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    menu_item_id uuid references public.menu_items(id) on delete set null,
    name_snapshot text not null,
    price_snapshot numeric(10, 2) not null check (price_snapshot >= 0),
    qty integer not null default 1 check (qty > 0),
    options_json jsonb not null default '[]'::jsonb,
    note text,
    status public.order_item_status not null default 'pending',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_order_items_updated_at
    before update on public.order_items
    for each row execute function public.handle_updated_at();

-- 4.9 payments: บันทึกการชำระเงิน (PromptPay พร้อมสลิป / เงินสด)
create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    method public.payment_method not null,
    amount numeric(10, 2) not null check (amount >= 0),
    ref text,
    slip_url text,
    verified_at timestamptz,
    verified_by uuid references auth.users(id) on delete set null,
    status public.payment_status not null default 'pending',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger trg_payments_updated_at
    before update on public.payments
    for each row execute function public.handle_updated_at();

-- ==============================================================================
-- 5. Performance Indexes
-- ==============================================================================

create index if not exists idx_shops_slug on public.shops(slug);
create index if not exists idx_shops_is_active on public.shops(is_active) where is_active = true;

create index if not exists idx_users_shop_id on public.users(shop_id);
create index if not exists idx_users_role on public.users(role);

create index if not exists idx_categories_shop_id on public.categories(shop_id, sort_order);

create index if not exists idx_menu_items_shop_id on public.menu_items(shop_id);
create index if not exists idx_menu_items_category_id on public.menu_items(category_id, sort_order);
create index if not exists idx_menu_items_available on public.menu_items(shop_id, is_available);

create index if not exists idx_options_menu_item_id on public.options(menu_item_id, sort_order);

create index if not exists idx_tables_shop_id on public.tables(shop_id);
create index if not exists idx_tables_qr_token on public.tables(qr_token);

create index if not exists idx_orders_shop_status on public.orders(shop_id, status);
create index if not exists idx_orders_table_id on public.orders(table_id);
create index if not exists idx_orders_created_at on public.orders(shop_id, created_at desc);

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_status on public.order_items(status);

create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_status on public.payments(status);

-- ==============================================================================
-- 6. Order Number Auto-generator (e.g. ORD-20260904-001)
-- ==============================================================================

create or replace function public.generate_order_no()
returns trigger as $$
declare
    today_str text;
    next_seq int;
begin
    if new.order_no is null or trim(new.order_no) = '' then
        today_str := to_char(timezone('Asia/Bangkok', now()), 'YYYYMMDD');
        
        select coalesce(count(*), 0) + 1
        into next_seq
        from public.orders
        where shop_id = new.shop_id
          and to_char(timezone('Asia/Bangkok', created_at), 'YYYYMMDD') = today_str;

        new.order_no := 'ORD-' || today_str || '-' || lpad(next_seq::text, 3, '0');
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger trg_orders_order_no
    before insert on public.orders
    for each row execute function public.generate_order_no();

-- ==============================================================================
-- 7. Realtime Publication Setup
-- ==============================================================================

do $$ begin
    alter publication supabase_realtime add table public.orders;
exception when others then null;
end $$;

do $$ begin
    alter publication supabase_realtime add table public.order_items;
exception when others then null;
end $$;

do $$ begin
    alter publication supabase_realtime add table public.tables;
exception when others then null;
end $$;

do $$ begin
    alter publication supabase_realtime add table public.payments;
exception when others then null;
end $$;

-- ==============================================================================
-- 8. Storage Buckets Setup
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
    ('shop-assets', 'shop-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
    ('payment-slips', 'payment-slips', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
