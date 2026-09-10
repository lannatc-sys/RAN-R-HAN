-- ==============================================================================
-- Rab-R-HAN (รับอาหาร) Multi-tenant SaaS Restaurant Platform
-- Combined Migration Script (All-in-One for Supabase SQL Editor)
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

drop trigger if exists trg_shops_updated_at on public.shops;
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

drop trigger if exists trg_users_updated_at on public.users;
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

drop trigger if exists trg_categories_updated_at on public.categories;
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

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
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

drop trigger if exists trg_options_updated_at on public.options;
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

drop trigger if exists trg_tables_updated_at on public.tables;
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

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
    before update on public.orders
    for each row execute function public.handle_updated_at();

-- 4.8 order_items: รายการอาหารในคำสั่งซื้อ
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

drop trigger if exists trg_order_items_updated_at on public.order_items;
create trigger trg_order_items_updated_at
    before update on public.order_items
    for each row execute function public.handle_updated_at();

-- 4.9 payments: บันทึกการชำระเงิน
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

drop trigger if exists trg_payments_updated_at on public.payments;
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

drop trigger if exists trg_orders_order_no on public.orders;
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

-- ==============================================================================
-- 9. Row Level Security Helper Functions
-- ==============================================================================

create or replace function public.current_user_profile()
returns public.users as $$
    select *
    from public.users
    where id = auth.uid()
    limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function public.is_superadmin()
returns boolean as $$
    select exists (
        select 1
        from public.users
        where id = auth.uid()
          and role = 'superadmin'
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_shop_id()
returns uuid as $$
    select shop_id
    from public.users
    where id = auth.uid()
    limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function public.has_shop_access(lookup_shop_id uuid)
returns boolean as $$
    select exists (
        select 1
        from public.users
        where id = auth.uid()
          and (role = 'superadmin' or shop_id = lookup_shop_id)
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_shop_owner(lookup_shop_id uuid)
returns boolean as $$
    select exists (
        select 1
        from public.users
        where id = auth.uid()
          and (role = 'superadmin' or (shop_id = lookup_shop_id and role = 'owner'))
    );
$$ language sql stable security definer set search_path = public;

-- ==============================================================================
-- 10. Enable Row Level Security
-- ==============================================================================

alter table public.shops enable row level security;
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.options enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- Drop existing policies if rerun
drop policy if exists "Public can view active shops" on public.shops;
drop policy if exists "Members can view own shop" on public.shops;
drop policy if exists "Owners and Superadmin can update own shop" on public.shops;
drop policy if exists "Authenticated users can create shop" on public.shops;

drop policy if exists "Users can view members in same shop or self" on public.users;
drop policy if exists "Users can insert own profile or owner can add staff" on public.users;
drop policy if exists "Users can update self or owner can update staff" on public.users;
drop policy if exists "Owners can delete staff" on public.users;

drop policy if exists "Public can view categories of active shops" on public.categories;
drop policy if exists "Staff can insert categories" on public.categories;
drop policy if exists "Staff can update categories" on public.categories;
drop policy if exists "Staff can delete categories" on public.categories;

drop policy if exists "Public can view available menu items" on public.menu_items;
drop policy if exists "Staff can insert menu items" on public.menu_items;
drop policy if exists "Staff can update menu items" on public.menu_items;
drop policy if exists "Staff can delete menu items" on public.menu_items;

drop policy if exists "Public can view options for available items" on public.options;
drop policy if exists "Staff can insert options" on public.options;
drop policy if exists "Staff can update options" on public.options;
drop policy if exists "Staff can delete options" on public.options;

drop policy if exists "Public can view tables" on public.tables;
drop policy if exists "Staff can insert tables" on public.tables;
drop policy if exists "Staff can update tables" on public.tables;
drop policy if exists "Staff can delete tables" on public.tables;

drop policy if exists "Orders viewable by customer and staff" on public.orders;
drop policy if exists "Anyone can insert orders to active shops" on public.orders;
drop policy if exists "Staff and customer can update orders" on public.orders;

drop policy if exists "Order items viewable by order owner and staff" on public.order_items;
drop policy if exists "Order items insertable on valid orders" on public.order_items;
drop policy if exists "Order items updatable by staff" on public.order_items;

drop policy if exists "Payments viewable by customer and staff" on public.payments;
drop policy if exists "Payments insertable by customer and staff" on public.payments;
drop policy if exists "Payments updatable by staff" on public.payments;

drop policy if exists "Shop assets are publicly readable" on storage.objects;
drop policy if exists "Authenticated users can upload shop assets" on storage.objects;
drop policy if exists "Anyone can upload payment slips" on storage.objects;
drop policy if exists "Staff can view payment slips" on storage.objects;

-- Apply Policies

-- shops
create policy "Public can view active shops"
    on public.shops for select
    using (is_active = true and status = 'active');

create policy "Members can view own shop"
    on public.shops for select
    using (public.has_shop_access(id));

create policy "Owners and Superadmin can update own shop"
    on public.shops for update
    using (public.is_shop_owner(id))
    with check (public.is_shop_owner(id));

create policy "Authenticated users can create shop"
    on public.shops for insert
    with check (auth.role() = 'authenticated');

-- users
create policy "Users can view members in same shop or self"
    on public.users for select
    using (
        id = auth.uid()
        or public.is_superadmin()
        or (shop_id is not null and shop_id = public.current_user_shop_id())
    );

create policy "Users can insert own profile or owner can add staff"
    on public.users for insert
    with check (
        id = auth.uid()
        or public.is_shop_owner(shop_id)
        or public.is_superadmin()
    );

create policy "Users can update self or owner can update staff"
    on public.users for update
    using (
        id = auth.uid()
        or public.is_shop_owner(shop_id)
        or public.is_superadmin()
    )
    with check (
        id = auth.uid()
        or public.is_shop_owner(shop_id)
        or public.is_superadmin()
    );

create policy "Owners can delete staff"
    on public.users for delete
    using (public.is_shop_owner(shop_id) or public.is_superadmin());

-- categories
create policy "Public can view categories of active shops"
    on public.categories for select
    using (
        exists (
            select 1 from public.shops
            where shops.id = categories.shop_id
              and shops.is_active = true
              and shops.status = 'active'
        )
        or public.has_shop_access(shop_id)
    );

create policy "Staff can insert categories"
    on public.categories for insert
    with check (public.has_shop_access(shop_id));

create policy "Staff can update categories"
    on public.categories for update
    using (public.has_shop_access(shop_id))
    with check (public.has_shop_access(shop_id));

create policy "Staff can delete categories"
    on public.categories for delete
    using (public.has_shop_access(shop_id));

-- menu_items
create policy "Public can view available menu items"
    on public.menu_items for select
    using (
        exists (
            select 1 from public.shops
            where shops.id = menu_items.shop_id
              and shops.is_active = true
              and shops.status = 'active'
        )
        or public.has_shop_access(shop_id)
    );

create policy "Staff can insert menu items"
    on public.menu_items for insert
    with check (public.has_shop_access(shop_id));

create policy "Staff can update menu items"
    on public.menu_items for update
    using (public.has_shop_access(shop_id))
    with check (public.has_shop_access(shop_id));

create policy "Staff can delete menu items"
    on public.menu_items for delete
    using (public.has_shop_access(shop_id));

-- options
create policy "Public can view options for available items"
    on public.options for select
    using (
        exists (
            select 1 from public.menu_items
            join public.shops on shops.id = menu_items.shop_id
            where menu_items.id = options.menu_item_id
              and shops.is_active = true
              and shops.status = 'active'
        )
        or exists (
            select 1 from public.menu_items
            where menu_items.id = options.menu_item_id
              and public.has_shop_access(menu_items.shop_id)
        )
    );

create policy "Staff can insert options"
    on public.options for insert
    with check (
        exists (
            select 1 from public.menu_items
            where menu_items.id = options.menu_item_id
              and public.has_shop_access(menu_items.shop_id)
        )
    );

create policy "Staff can update options"
    on public.options for update
    using (
        exists (
            select 1 from public.menu_items
            where menu_items.id = options.menu_item_id
              and public.has_shop_access(menu_items.shop_id)
        )
    )
    with check (
        exists (
            select 1 from public.menu_items
            where menu_items.id = options.menu_item_id
              and public.has_shop_access(menu_items.shop_id)
        )
    );

create policy "Staff can delete options"
    on public.options for delete
    using (
        exists (
            select 1 from public.menu_items
            where menu_items.id = options.menu_item_id
              and public.has_shop_access(menu_items.shop_id)
        )
    );

-- tables
create policy "Public can view tables"
    on public.tables for select
    using (
        exists (
            select 1 from public.shops
            where shops.id = tables.shop_id
              and shops.is_active = true
              and shops.status = 'active'
        )
        or public.has_shop_access(shop_id)
    );

create policy "Staff can insert tables"
    on public.tables for insert
    with check (public.has_shop_access(shop_id));

create policy "Staff can update tables"
    on public.tables for update
    using (public.has_shop_access(shop_id))
    with check (public.has_shop_access(shop_id));

create policy "Staff can delete tables"
    on public.tables for delete
    using (public.has_shop_access(shop_id));

-- orders
create policy "Orders viewable by customer and staff"
    on public.orders for select
    using (
        public.has_shop_access(shop_id)
        or true
    );

create policy "Anyone can insert orders to active shops"
    on public.orders for insert
    with check (
        exists (
            select 1 from public.shops
            where shops.id = orders.shop_id
              and shops.is_active = true
              and shops.status = 'active'
        )
        or public.has_shop_access(shop_id)
    );

create policy "Staff and customer can update orders"
    on public.orders for update
    using (
        public.has_shop_access(shop_id)
        or (status = 'pending')
    )
    with check (
        public.has_shop_access(shop_id)
        or (status in ('pending', 'cancelled'))
    );

-- order_items
create policy "Order items viewable by order owner and staff"
    on public.order_items for select
    using (
        exists (
            select 1 from public.orders
            where orders.id = order_items.order_id
              and (public.has_shop_access(orders.shop_id) or true)
        )
    );

create policy "Order items insertable on valid orders"
    on public.order_items for insert
    with check (
        exists (
            select 1 from public.orders
            where orders.id = order_items.order_id
        )
    );

create policy "Order items updatable by staff"
    on public.order_items for update
    using (
        exists (
            select 1 from public.orders
            where orders.id = order_items.order_id
              and public.has_shop_access(orders.shop_id)
        )
    );

-- payments
create policy "Payments viewable by customer and staff"
    on public.payments for select
    using (
        exists (
            select 1 from public.orders
            where orders.id = payments.order_id
              and (public.has_shop_access(orders.shop_id) or true)
        )
    );

create policy "Payments insertable by customer and staff"
    on public.payments for insert
    with check (
        exists (
            select 1 from public.orders
            where orders.id = payments.order_id
        )
    );

create policy "Payments updatable by staff"
    on public.payments for update
    using (
        exists (
            select 1 from public.orders
            where orders.id = payments.order_id
              and public.has_shop_access(orders.shop_id)
        )
    )
    with check (
        exists (
            select 1 from public.orders
            where orders.id = payments.order_id
              and public.has_shop_access(orders.shop_id)
        )
    );

-- storage.objects
create policy "Shop assets are publicly readable"
    on storage.objects for select
    using (bucket_id = 'shop-assets');

create policy "Authenticated users can upload shop assets"
    on storage.objects for insert
    with check (
        bucket_id = 'shop-assets'
        and auth.role() = 'authenticated'
    );

create policy "Anyone can upload payment slips"
    on storage.objects for insert
    with check (bucket_id = 'payment-slips');

create policy "Staff can view payment slips"
    on storage.objects for select
    using (
        bucket_id = 'payment-slips'
        and auth.role() = 'authenticated'
    );

-- ==============================================================================
-- RIDER SYSTEM — Phase 1 (Migration 20260911000001 + 000002 + 000003)
-- ต้องรัน run_all.sql ก่อน แล้วค่อยรัน migrations ต่อไปนี้แยก:
--   1. supabase/migrations/20260911000001_rider_system.sql
--   2. supabase/migrations/20260911000002_rider_rls.sql
--   3. supabase/migrations/20260911000003_rider_rpc_functions.sql
-- หรือ copy เนื้อหาจากทั้งสามไฟล์มาต่อท้ายนี้เพื่อรันครั้งเดียว
-- ==============================================================================
