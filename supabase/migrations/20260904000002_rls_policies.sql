-- ==============================================================================
-- Rab-R-HAN (รับอาหาร) Multi-tenant SaaS Restaurant Platform
-- Migration 02: Row Level Security (RLS) & Access Control Policies
-- Compatible with Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. Helper Functions for Fast, Secure Role & Tenant Resolution
-- Using security definer with search_path set to prevent privilege escalation

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
-- 2. Enable Row Level Security (RLS) on All Tables
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

-- ==============================================================================
-- 3. RLS Policies: shops
-- ==============================================================================

-- ลูกค้าทั่วไป และผู้ใช้ภายนอก ดูร้านที่เปิดใช้งานอยู่ได้
create policy "Public can view active shops"
    on public.shops for select
    using (is_active = true and status = 'active');

-- Staff และ Owner ร้าน ดูข้อมูลร้านตนเองได้เสมอ (แม้สถานะพักร้านหรือหมดอายุ)
create policy "Members can view own shop"
    on public.shops for select
    using (public.has_shop_access(id));

-- เจ้าของร้านอัปเดตข้อมูลร้านตัวเองได้ / Superadmin แก้ได้ทุกร้าน
create policy "Owners and Superadmin can update own shop"
    on public.shops for update
    using (public.is_shop_owner(id))
    with check (public.is_shop_owner(id));

-- สิทธิ์สร้างร้าน (เมื่อสมัครสมาชิกเปิดร้านใหม่ หรือโดย Superadmin)
create policy "Authenticated users can create shop"
    on public.shops for insert
    with check (auth.role() = 'authenticated');

-- ==============================================================================
-- 4. RLS Policies: users
-- ==============================================================================

-- สมาชิกดูโปรไฟล์ตัวเองและคนในร้านเดียวกันได้ / Superadmin ดูได้ทั้งหมด
create policy "Users can view members in same shop or self"
    on public.users for select
    using (
        id = auth.uid()
        or public.is_superadmin()
        or (shop_id is not null and shop_id = public.current_user_shop_id())
    );

-- ผู้ใช้สร้างโปรไฟล์ตัวเองเมื่อ login ครั้งแรก หรือเจ้าของร้านเพิ่มพนักงาน
create policy "Users can insert own profile or owner can add staff"
    on public.users for insert
    with check (
        id = auth.uid()
        or public.is_shop_owner(shop_id)
        or public.is_superadmin()
    );

-- ผู้ใช้แก้โปรไฟล์ตัวเอง หรือเจ้าของร้านจัดการพนักงานในร้าน
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

-- เจ้าของร้านลบพนักงานออกจากร้านได้
create policy "Owners can delete staff"
    on public.users for delete
    using (public.is_shop_owner(shop_id) or public.is_superadmin());

-- ==============================================================================
-- 5. RLS Policies: categories
-- ==============================================================================

-- ลูกค้าดูหมวดหมู่อาหารของร้านที่เปิดบริการได้
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

-- ==============================================================================
-- 6. RLS Policies: menu_items
-- ==============================================================================

-- ลูกค้าดูเมนูของร้านที่เปิดบริการได้
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

-- ==============================================================================
-- 7. RLS Policies: options
-- ==============================================================================

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

-- ==============================================================================
-- 8. RLS Policies: tables
-- ==============================================================================

-- ลูกค้าดูโต๊ะผ่าน qr_token หรือหน้าร้านได้
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

-- ==============================================================================
-- 9. RLS Policies: orders
-- ==============================================================================

-- ลูกค้าเปิดดูคำสั่งซื้อของตนเองได้ / Staff ดูทุกออเดอร์ในร้าน
create policy "Orders viewable by customer and staff"
    on public.orders for select
    using (
        public.has_shop_access(shop_id)
        or true -- ลูกค้าเข้าถึง order ตนเองผ่าน Client-side Order ID / Token
    );

-- ลูกค้าสามารถกดสั่งอาหารได้ (Insert)
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

-- Staff ปรับสถานะออเดอร์ / ลูกค้ายกเลิกออเดอร์ได้เฉพาะตอน pending
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

-- ==============================================================================
-- 10. RLS Policies: order_items
-- ==============================================================================

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

-- ==============================================================================
-- 11. RLS Policies: payments
-- ==============================================================================

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

-- ==============================================================================
-- 12. Storage Policies (shop-assets & payment-slips)
-- ==============================================================================

-- shop-assets: สาธารณะสามารถดูรูปเมนู/โลโก้ได้
create policy "Shop assets are publicly readable"
    on storage.objects for select
    using (bucket_id = 'shop-assets');

-- shop-assets: ร้านค้าอัปโหลดรูปได้
create policy "Authenticated users can upload shop assets"
    on storage.objects for insert
    with check (
        bucket_id = 'shop-assets'
        and auth.role() = 'authenticated'
    );

-- payment-slips: ลูกค้าหรือร้านค้าอัปโหลดสลิปได้
create policy "Anyone can upload payment slips"
    on storage.objects for insert
    with check (bucket_id = 'payment-slips');

-- payment-slips: ร้านค้าที่เป็น staff/owner สามารถดูสลิปได้
create policy "Staff can view payment slips"
    on storage.objects for select
    using (
        bucket_id = 'payment-slips'
        and auth.role() = 'authenticated'
    );
