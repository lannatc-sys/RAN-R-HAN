-- ==============================================================================
-- MIGRATION: 20260911000001_rider_system.sql
-- Rider Delivery & Dispatch System — Phase 1 Schema
-- อ้างอิง: docs/03-rider-system-architecture.md
-- ==============================================================================

-- ==============================================================================
-- 1. Extensions
-- ==============================================================================
create extension if not exists postgis with schema extensions;

-- ==============================================================================
-- 2. Enums
-- ==============================================================================
do $$ begin
  create type public.rider_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.offer_status as enum ('offered', 'accepted', 'rejected', 'timed_out');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.delivery_event_type as enum (
    'departed_to_shop',
    'arrived_at_shop',
    'picked_up',
    'departed_to_customer',
    'delivered',
    'unreachable_drop',
    'breakdown'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.settlement_status as enum (
    'draft',
    'reviewing',
    'approved',
    'executing',
    'completed',
    'exception'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.work_session_status as enum ('open', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pool_ledger_direction as enum ('in', 'out');
exception when duplicate_object then null;
end $$;

-- ==============================================================================
-- 3. ตาราง riders — ข้อมูลโปรไฟล์ไรเดอร์
-- ==============================================================================
create table if not exists public.riders (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references public.shops(id) on delete cascade,
  -- เชื่อมกับ Supabase Auth (auth.users) — null ได้ถ้ายังไม่ได้ invite
  auth_user_id        uuid references auth.users(id) on delete set null,
  display_name        text not null,
  phone               text not null,
  -- ประเภทยานพาหนะ (motorcycle, bicycle, car ฯลฯ)
  vehicle_type        text not null default 'motorcycle',
  status              public.rider_status not null default 'active',
  -- Performance Score 0.0–5.0 (คำนวณรายเดือน, รอกำหนดสูตรจริง)
  performance_score   numeric(3,2) not null default 5.00 check (performance_score between 0 and 5),
  -- Metadata
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ==============================================================================
-- 4. ตาราง rider_work_sessions — การเปิด/ปิดงานของไรเดอร์
-- ==============================================================================
create table if not exists public.rider_work_sessions (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders(id) on delete cascade,
  shop_id      uuid not null references public.shops(id) on delete cascade,
  status       public.work_session_status not null default 'open',
  started_at   timestamptz not null default now(),
  closed_at    timestamptz,
  -- Device info (optional) เพื่อ debug
  device_info  jsonb,
  created_at   timestamptz not null default now()
);

-- ==============================================================================
-- 5. ตาราง rider_current_locations — พิกัดปัจจุบันของไรเดอร์ (Overwrite 1 Row/Rider)
-- ==============================================================================
create table if not exists public.rider_current_locations (
  -- rider_id เป็น PK (1 row ต่อ 1 ไรเดอร์ → Overwrite ทุกครั้ง)
  rider_id         uuid primary key references public.riders(id) on delete cascade,
  shop_id          uuid not null references public.shops(id) on delete cascade,
  -- ผูกกับ work_session ที่กำลังเปิดอยู่
  work_session_id  uuid references public.rider_work_sessions(id) on delete set null,
  lat              double precision not null,
  lng              double precision not null,
  -- PostGIS geometry (EPSG:4326 = WGS84)
  geom             extensions.geometry(Point, 4326) generated always as (extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)) stored,
  accuracy         numeric(8, 2), -- GPS accuracy in meters
  heading          numeric(5, 2), -- ทิศทาง (degrees)
  speed            numeric(6, 2), -- km/h
  updated_at       timestamptz not null default now()
);

-- ==============================================================================
-- 6. ตาราง dispatch_offers — Audit Trail ของการส่ง Offer ทุกรายการ
-- ==============================================================================
create table if not exists public.dispatch_offers (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  rider_id       uuid not null references public.riders(id) on delete cascade,
  shop_id        uuid not null references public.shops(id) on delete cascade,
  status         public.offer_status not null default 'offered',
  -- Dispatch round (รอบที่ 1, 2, 3 ของ Fallback Loop)
  dispatch_round smallint not null default 1,
  -- Dispatch Score ที่ระบบคำนวณได้ ณ ขณะนั้น (เพื่อ Audit)
  dispatch_score numeric(10, 4),
  -- Estimated Time of Arrival จาก Mapbox (วินาที) ณ ขณะคำนวณ
  estimated_eta_seconds integer,
  offered_at     timestamptz not null default now(),
  -- Server timeout timestamp (30–45 วินาที — รอกำหนดค่าจาก Config)
  timeout_at     timestamptz,
  responded_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- ==============================================================================
-- 7. ตาราง delivery_events — Event Log ตลอดการจัดส่ง
-- ==============================================================================
create table if not exists public.delivery_events (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  rider_id           uuid not null references public.riders(id) on delete cascade,
  shop_id            uuid not null references public.shops(id) on delete cascade,
  event_type         public.delivery_event_type not null,
  -- Server Timestamp (Source of Truth — ไม่ใช้นาฬิกามือถือ)
  server_received_at timestamptz not null default now(),
  -- พิกัด GPS ขณะเกิด Event
  gps_lat            double precision,
  gps_lng            double precision,
  -- หมายเหตุ (เช่น กรณี Breakdown / Unreachable)
  note               text,
  created_at         timestamptz not null default now()
);

-- ==============================================================================
-- 8. ตาราง pod_uploads — Proof of Delivery Metadata + Watermark
-- ==============================================================================
create table if not exists public.pod_uploads (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  rider_id            uuid not null references public.riders(id) on delete cascade,
  shop_id             uuid not null references public.shops(id) on delete cascade,
  delivery_event_id   uuid references public.delivery_events(id) on delete set null,
  -- Path ใน Supabase Storage (ก่อน Archive ย้ายไป Google Drive)
  storage_path        text not null,
  -- event_type ซ้ำไว้เพื่อ Query ง่าย (ไม่ต้อง JOIN delivery_events เสมอ)
  event_type          public.delivery_event_type not null,
  -- Server Timestamp (Source of Truth)
  server_received_at  timestamptz not null default now(),
  -- พิกัด GPS ขณะถ่ายภาพ
  gps_lat             double precision,
  gps_lng             double precision,
  -- Archive lifecycle
  archived_at         timestamptz,
  gdrive_file_id      text,
  archive_path        text,
  created_at          timestamptz not null default now()
);

-- ==============================================================================
-- 9. ตาราง daily_settlements — Settlement State Machine รายวัน
-- ==============================================================================
create table if not exists public.daily_settlements (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references public.shops(id) on delete cascade,
  settlement_date      date not null,
  status               public.settlement_status not null default 'draft',
  -- ยอดรวม (คำนวณเมื่อสร้าง Draft, อาจ recalculate ระหว่าง Reviewing)
  total_orders         integer not null default 0,
  total_delivery_fee   numeric(12, 2) not null default 0,
  total_rider_payout   numeric(12, 2) not null default 0,
  total_rider_pool     numeric(12, 2) not null default 0,
  -- จำนวน Exception Order ที่รอ Review
  exception_count      integer not null default 0,
  -- ผู้อนุมัติ
  approved_by          uuid references auth.users(id) on delete set null,
  approved_at          timestamptz,
  -- หมายเหตุของ Admin
  admin_note           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- 1 shop = 1 settlement ต่อวัน
  unique (shop_id, settlement_date)
);

-- ==============================================================================
-- 10. ตาราง settlement_line_items — รายละเอียดการจ่ายเงินรายออเดอร์
-- ==============================================================================
create table if not exists public.settlement_line_items (
  id                  uuid primary key default gen_random_uuid(),
  settlement_id       uuid not null references public.daily_settlements(id) on delete cascade,
  order_id            uuid not null references public.orders(id) on delete cascade,
  rider_id            uuid references public.riders(id) on delete set null,
  shop_id             uuid not null references public.shops(id) on delete cascade,
  -- ค่าจัดส่งที่เรียกเก็บจากลูกค้า
  delivery_fee        numeric(10, 2) not null default 0,
  -- ส่วนที่ร้านค้าจ่าย (50% ตาม Base Rate)
  shop_portion        numeric(10, 2) not null default 0,
  -- ค่าตอบแทนไรเดอร์ (ตาม Rate Card)
  rider_payout        numeric(10, 2) not null default 0,
  -- ส่วนต่างที่เข้ากองกลาง Rider Pool
  rider_pool_amount   numeric(10, 2) not null default 0,
  -- ระยะทางจริงจาก GPS (กม.)
  actual_distance_km  numeric(6, 2),
  -- flags: เช่น PENDING_REVIEW, DETOUR_FLAGGED, BATCH_ORDER
  flags               text[] not null default '{}',
  -- หมายเหตุ
  note                text,
  created_at          timestamptz not null default now()
);

-- ==============================================================================
-- 11. ตาราง rider_pool_ledger — รายการรับ-จ่ายเงินกองกลาง Rider Pool
-- ==============================================================================
create table if not exists public.rider_pool_ledger (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  settlement_id   uuid references public.daily_settlements(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  direction       public.pool_ledger_direction not null,
  amount          numeric(10, 2) not null check (amount > 0),
  -- เหตุผล เช่น 'delivery_surplus', 'rescue_bonus', 'rain_bonus', 'welfare'
  reason          text not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ==============================================================================
-- 12. เพิ่มคอลัมน์ delivery-related ใน orders (ถ้ายังไม่มี)
-- ==============================================================================
-- order_type เพิ่ม 'delivery' enum value
do $$ begin
  alter type public.order_type add value if not exists 'delivery';
exception when others then null;
end $$;

-- เพิ่มคอลัมน์ที่เกี่ยวกับการจัดส่ง
alter table public.orders
  add column if not exists assigned_rider_id uuid references public.riders(id) on delete set null,
  add column if not exists dispatch_status    text check (dispatch_status in (
    'pending', 'dispatching', 'assigned', 'in_transit', 'delivered', 'failed'
  )),
  -- พิกัดปลายทาง (ลูกค้า)
  add column if not exists delivery_lat       double precision,
  add column if not exists delivery_lng       double precision,
  add column if not exists delivery_address   text,
  -- ค่าจัดส่งที่คำนวณได้
  add column if not exists delivery_fee       numeric(10,2) default 0,
  -- ระยะทางที่คำนวณจาก Mapbox (กม.)
  add column if not exists estimated_distance_km numeric(6,2);

-- ==============================================================================
-- 13. INDEXES
-- ==============================================================================

-- riders
create index if not exists idx_riders_shop_status on public.riders(shop_id, status);
create index if not exists idx_riders_auth_user on public.riders(auth_user_id);

-- work_sessions
create index if not exists idx_work_sessions_rider on public.rider_work_sessions(rider_id);
create index if not exists idx_work_sessions_shop_status on public.rider_work_sessions(shop_id, status);
create index if not exists idx_work_sessions_open on public.rider_work_sessions(rider_id, status)
  where status = 'open';

-- current_locations — PostGIS Spatial Index
create index if not exists idx_rider_locations_geom on public.rider_current_locations using gist(geom);
create index if not exists idx_rider_locations_shop on public.rider_current_locations(shop_id);

-- dispatch_offers
create index if not exists idx_dispatch_offers_order on public.dispatch_offers(order_id);
create index if not exists idx_dispatch_offers_rider on public.dispatch_offers(rider_id);
create index if not exists idx_dispatch_offers_status on public.dispatch_offers(status, offered_at);

-- delivery_events
create index if not exists idx_delivery_events_order on public.delivery_events(order_id);
create index if not exists idx_delivery_events_rider on public.delivery_events(rider_id);

-- pod_uploads
create index if not exists idx_pod_uploads_order on public.pod_uploads(order_id);
create index if not exists idx_pod_uploads_rider on public.pod_uploads(rider_id);
create index if not exists idx_pod_uploads_archived on public.pod_uploads(archived_at) where archived_at is null;

-- settlements
create index if not exists idx_settlements_shop_date on public.daily_settlements(shop_id, settlement_date desc);
create index if not exists idx_settlement_items_settlement on public.settlement_line_items(settlement_id);
create index if not exists idx_settlement_items_rider on public.settlement_line_items(rider_id);
create index if not exists idx_pool_ledger_shop on public.rider_pool_ledger(shop_id, created_at desc);

-- orders delivery columns
create index if not exists idx_orders_rider on public.orders(assigned_rider_id) where assigned_rider_id is not null;
create index if not exists idx_orders_dispatch_status on public.orders(dispatch_status) where dispatch_status is not null;

-- ==============================================================================
-- 14. updated_at auto-trigger สำหรับตารางใหม่
-- ==============================================================================
-- ใช้ function handle_updated_at() ที่มีอยู่แล้วจาก migration 01
create or replace trigger set_riders_updated_at
  before update on public.riders
  for each row execute function public.handle_updated_at();

create or replace trigger set_daily_settlements_updated_at
  before update on public.daily_settlements
  for each row execute function public.handle_updated_at();

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
