-- ==============================================================================
-- MIGRATION: 20260911000003_rider_rpc_functions.sql
-- PostgreSQL Functions สำหรับ Dispatch Engine
-- ==============================================================================

-- ==============================================================================
-- 1. find_available_riders — หาไรเดอร์ที่พร้อมรับงานในรัศมีที่กำหนด
-- ใช้ PostGIS ST_DWithin เพื่อ Spatial Filtering ก่อน Dispatch Score
-- ==============================================================================
create or replace function public.find_available_riders(
  p_shop_id           uuid,
  p_lat               double precision,
  p_lng               double precision,
  p_radius_m          double precision,
  p_exclude_rider_ids uuid[]
)
returns table (
  id                uuid,
  display_name      text,
  performance_score numeric,
  lat               double precision,
  lng               double precision,
  distance_m        double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    r.id,
    r.display_name,
    r.performance_score,
    rcl.lat,
    rcl.lng,
    -- ระยะทางตรงจาก PostGIS (เมตร)
    ST_Distance(
      rcl.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) as distance_m
  from public.riders r
  -- ต้องมีพิกัดปัจจุบัน (= มี work session เปิดอยู่)
  join public.rider_current_locations rcl on rcl.rider_id = r.id
  -- ต้องมี work session open
  join public.rider_work_sessions rws on rws.rider_id = r.id and rws.status = 'open'
  where
    (auth.role() = 'service_role' or public.has_shop_access(p_shop_id))
    and r.shop_id = p_shop_id
    and r.status = 'active'
    -- Spatial filter — อยู่ในรัศมี
    and ST_DWithin(
      rcl.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    -- ไม่รวม rider ที่ถูก exclude (reject/timeout/busy)
    and r.id != all(coalesce(p_exclude_rider_ids, '{}'::uuid[]))
  order by distance_m asc
  limit 5;
$$;

-- ==============================================================================
-- 2. get_rider_active_order_count — นับ Order ที่ไรเดอร์กำลังรับงานอยู่
-- ใช้ตรวจว่าไรเดอร์รับได้อีกหรือไม่ (Phase 1: max 2 orders)
-- ==============================================================================
create or replace function public.get_rider_active_order_count(p_rider_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
  select count(*)::integer
  from public.orders
  where assigned_rider_id = p_rider_id
    and dispatch_status in ('assigned', 'in_transit');
$$;

-- ==============================================================================
-- 3. create_daily_settlement_draft — สร้าง Daily Settlement Draft
-- เรียกเมื่อสิ้นวัน (Cron Job)
-- ==============================================================================
create or replace function public.create_daily_settlement_draft(
  p_shop_id        uuid,
  p_settlement_date date default (current_date - 1)
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settlement_id uuid;
  v_total_orders integer;
  v_total_delivery_fee numeric;
  v_total_rider_payout numeric;
  v_total_rider_pool numeric;
begin
  -- ตรวจว่ามี settlement ของวันนี้แล้วหรือยัง
  select id into v_settlement_id
  from public.daily_settlements
  where shop_id = p_shop_id
    and settlement_date = p_settlement_date;

  if v_settlement_id is not null then
    return v_settlement_id; -- มีแล้ว ส่งกลับ id เดิม
  end if;

  -- คำนวณยอดจาก orders ที่ complete ในวันนั้น
  select
    count(*),
    coalesce(sum(delivery_fee), 0),
    -- Phase 1: rider_payout = 80% ของ delivery_fee (placeholder — รอ Rate Card จริง)
    coalesce(sum(delivery_fee * 0.8), 0),
    -- rider_pool = 20% ของ delivery_fee (placeholder)
    coalesce(sum(delivery_fee * 0.2), 0)
  into v_total_orders, v_total_delivery_fee, v_total_rider_payout, v_total_rider_pool
  from public.orders
  where shop_id = p_shop_id
    and dispatch_status = 'delivered'
    and (updated_at at time zone 'Asia/Bangkok')::date = p_settlement_date;

  -- สร้าง Draft
  insert into public.daily_settlements (
    shop_id,
    settlement_date,
    status,
    total_orders,
    total_delivery_fee,
    total_rider_payout,
    total_rider_pool
  ) values (
    p_shop_id,
    p_settlement_date,
    'draft',
    v_total_orders,
    v_total_delivery_fee,
    v_total_rider_payout,
    v_total_rider_pool
  )
  returning id into v_settlement_id;

  return v_settlement_id;
end;
$$;

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
