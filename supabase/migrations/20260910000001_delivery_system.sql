-- ==============================================================================
-- MIGRATION: 20260910000001_delivery_system.sql
-- โมดูลระบบจัดส่งรอบเวลา (Batch Delivery) และระบบพรีออเดอร์ (Preorder) สำหรับแม่ฮ่องสอน
-- ==============================================================================

-- 1. ตาราง Master Data สถานที่จุดรับสินค้า (Delivery Locations)
create table if not exists public.delivery_locations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade, -- null หมายถึงเป็นจุดรับกลางของระบบ
  name text not null,
  zone_name text not null default 'เขตเทศบาลเมืองแม่ฮ่องสอน',
  lat double precision not null,
  lng double precision not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. ตารางเที่ยวส่งของ (Delivery Trips)
create table if not exists public.delivery_trips (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  trip_name text not null,
  trip_date date not null default current_date,
  cutoff_at timestamptz,
  delivery_time_window text, -- เช่น "14:00 น. เป็นต้นไป"
  status text not null default 'draft' check (status in ('draft', 'in_transit', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. ตารางรายการส่งรายบุคคลในเที่ยว (Delivery Trip Items)
create table if not exists public.delivery_trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.delivery_trips(id) on delete cascade,
  location_id uuid references public.delivery_locations(id) on delete set null,
  recipient_name text not null,
  recipient_phone text not null,
  location_note text, -- จุดสังเกต เช่น "ข้างตู้ ATM 7-11"
  items_summary text not null, -- สรุปรายการสินค้า เช่น "หมูปิ้ง 5 ไม้ ข้าวเหนียว 2"
  order_reference_id uuid, -- สำหรับอ้างอิงกับ preorder_items หรือ orders
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. ตารางรอบพรีออเดอร์ (Preorder Rounds)
create table if not exists public.preorder_rounds (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  cutoff_at timestamptz not null,
  delivery_date date not null,
  delivery_time_window text,
  status text not null default 'open' check (status in ('open', 'closed', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. ตารางรายการสั่งจองพรีออเดอร์ (Preorder Items)
create table if not exists public.preorder_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.preorder_rounds(id) on delete cascade,
  location_id uuid references public.delivery_locations(id) on delete set null,
  recipient_name text not null,
  recipient_phone text not null,
  location_note text,
  items_summary text not null,
  total_amount numeric(10,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('promptpay', 'cash')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'verified')),
  raw_input_text text, -- บันทึกข้อความดิบจากคอมเมนต์ Facebook
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
create index if not exists idx_delivery_locations_shop on public.delivery_locations(shop_id);
create index if not exists idx_delivery_trips_shop on public.delivery_trips(shop_id);
create index if not exists idx_delivery_trip_items_trip on public.delivery_trip_items(trip_id);
create index if not exists idx_preorder_rounds_shop on public.preorder_rounds(shop_id);
create index if not exists idx_preorder_items_round on public.preorder_items(round_id);

-- ==============================================================================
-- RLS POLICIES (Row-Level Security)
-- ==============================================================================
alter table public.delivery_locations enable row level security;
alter table public.delivery_trips enable row level security;
alter table public.delivery_trip_items enable row level security;
alter table public.preorder_rounds enable row level security;
alter table public.preorder_items enable row level security;

-- delivery_locations: อ่านได้ทุกคน (ถ้าเป็นจุดรับกลางหรือของร้านตัวเอง) / จัดการได้เฉพาะ staff/owner หรือ service_role
drop policy if exists "Anyone can read active delivery locations" on public.delivery_locations;
create policy "Anyone can read active delivery locations"
  on public.delivery_locations for select
  using (is_active = true);

drop policy if exists "Shop staff can manage shop locations" on public.delivery_locations;
create policy "Shop staff can manage shop locations"
  on public.delivery_locations for all
  using (shop_id is null or has_shop_access(shop_id))
  with check (shop_id is null or has_shop_access(shop_id));

-- delivery_trips: เฉพาะ staff/owner
drop policy if exists "Shop staff can manage delivery trips" on public.delivery_trips;
create policy "Shop staff can manage delivery trips"
  on public.delivery_trips for all
  using (has_shop_access(shop_id))
  with check (has_shop_access(shop_id));

-- delivery_trip_items: เฉพาะ staff/owner ของร้านใน trip
drop policy if exists "Shop staff can manage delivery trip items" on public.delivery_trip_items;
create policy "Shop staff can manage delivery trip items"
  on public.delivery_trip_items for all
  using (
    exists (
      select 1 from public.delivery_trips t
      where t.id = trip_id and has_shop_access(t.shop_id)
    )
  )
  with check (
    exists (
      select 1 from public.delivery_trips t
      where t.id = trip_id and has_shop_access(t.shop_id)
    )
  );

-- preorder_rounds: เฉพาะ staff/owner
drop policy if exists "Shop staff can manage preorder rounds" on public.preorder_rounds;
create policy "Shop staff can manage preorder rounds"
  on public.preorder_rounds for all
  using (has_shop_access(shop_id))
  with check (has_shop_access(shop_id));

-- preorder_items: เฉพาะ staff/owner ของร้านใน round
drop policy if exists "Shop staff can manage preorder items" on public.preorder_items;
create policy "Shop staff can manage preorder items"
  on public.preorder_items for all
  using (
    exists (
      select 1 from public.preorder_rounds r
      where r.id = round_id and has_shop_access(r.shop_id)
    )
  )
  with check (
    exists (
      select 1 from public.preorder_rounds r
      where r.id = round_id and has_shop_access(r.shop_id)
    )
  );

-- ==============================================================================
-- SEED DATA: จุดรับสินค้าหลักในเขตเทศบาลเมืองแม่ฮ่องสอน
-- ==============================================================================
insert into public.delivery_locations (id, shop_id, name, zone_name, lat, lng, sort_order, is_active)
values
  ('10000000-0000-0000-0000-000000000001', null, 'กาดเทศบาลเมืองแม่ฮ่องสอน', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.300523, 97.967812, 1, true),
  ('10000000-0000-0000-0000-000000000002', null, 'หน้าโรงพยาบาลศรีสังวาลย์', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.302814, 97.963421, 2, true),
  ('10000000-0000-0000-0000-000000000003', null, 'สวนสาธารณะหนองจองคำ', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.299015, 97.969245, 3, true),
  ('10000000-0000-0000-0000-000000000004', null, 'หน้าศาลากลางจังหวัดแม่ฮ่องสอน', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.305241, 97.968712, 4, true),
  ('10000000-0000-0000-0000-000000000005', null, 'หน้าโรงเรียนห้องสอนศึกษา', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.303921, 97.965541, 5, true),
  ('10000000-0000-0000-0000-000000000006', null, 'วงเวียนหอนาฬิกา', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.301562, 97.966524, 6, true),
  ('10000000-0000-0000-0000-000000000007', null, 'สี่แยกไปรษณีย์แม่ฮ่องสอน', 'เขตเทศบาลเมืองแม่ฮ่องสอน', 19.300142, 97.964921, 7, true)
on conflict (id) do nothing;
