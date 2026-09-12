-- ==============================================================================
-- MIGRATION: 20260911000002_rider_rls.sql
-- Row-Level Security Policies สำหรับ Rider System
-- อ้างอิง: docs/03-rider-system-architecture.md §15
-- ==============================================================================
-- Pattern:
--   - ไรเดอร์: ดู/แก้ไขได้เฉพาะ row ของตัวเอง (auth.uid() = auth_user_id)
--   - Staff/Owner: เข้าถึงทุก row ใน shop ของตัวเอง (has_shop_access)
--   - Superadmin: เข้าถึงได้ทุกอย่าง (has_shop_access คืน true สำหรับ superadmin)
-- ==============================================================================

-- Helper function: ตรวจว่า user ปัจจุบันเป็นไรเดอร์ของร้านนั้น
create or replace function public.is_rider_of_shop(lookup_shop_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.riders r
    where r.auth_user_id = auth.uid()
      and r.shop_id = lookup_shop_id
      and r.status = 'active'
  );
$$ language sql stable security definer set search_path = public;

-- Helper function: ตรวจว่า user ปัจจุบันเป็นไรเดอร์ที่มี id นั้น
create or replace function public.is_own_rider_id(lookup_rider_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.riders r
    where r.id = lookup_rider_id
      and r.auth_user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- ==============================================================================
-- 1. riders
-- ==============================================================================
alter table public.riders enable row level security;

-- ไรเดอร์ดูข้อมูลตัวเอง
drop policy if exists "Rider can view own profile" on public.riders;
create policy "Rider can view own profile"
  on public.riders for select
  using (auth_user_id = auth.uid());

-- Staff/Owner/Superadmin ดู+จัดการไรเดอร์ในร้าน
drop policy if exists "Shop staff can manage riders" on public.riders;
create policy "Shop staff can manage riders"
  on public.riders for all
  using (public.has_shop_access(shop_id))
  with check (public.has_shop_access(shop_id));

-- ==============================================================================
-- 2. rider_work_sessions
-- ==============================================================================
alter table public.rider_work_sessions enable row level security;

-- ไรเดอร์ดูและสร้าง/ปิด session ของตัวเอง
drop policy if exists "Rider can manage own work sessions" on public.rider_work_sessions;
create policy "Rider can manage own work sessions"
  on public.rider_work_sessions for all
  using (public.is_own_rider_id(rider_id))
  with check (
    public.is_own_rider_id(rider_id)
    and shop_id = (select r.shop_id from public.riders r where r.id = rider_id)
  );

-- Staff/Admin ดู session ทั้งหมดของร้าน (read-only)
drop policy if exists "Shop staff can view work sessions" on public.rider_work_sessions;
create policy "Shop staff can view work sessions"
  on public.rider_work_sessions for select
  using (public.has_shop_access(shop_id));

-- ==============================================================================
-- 3. rider_current_locations
-- ==============================================================================
alter table public.rider_current_locations enable row level security;

-- ไรเดอร์ upsert พิกัดของตัวเอง
drop policy if exists "Rider can upsert own location" on public.rider_current_locations;
create policy "Rider can upsert own location"
  on public.rider_current_locations for all
  using (public.is_own_rider_id(rider_id))
  with check (
    public.is_own_rider_id(rider_id)
    and shop_id = (select r.shop_id from public.riders r where r.id = rider_id)
  );

-- Staff/Admin ดูพิกัดไรเดอร์ทั้งหมดในร้าน (เพื่อ Dispatch)
drop policy if exists "Shop staff can view rider locations" on public.rider_current_locations;
create policy "Shop staff can view rider locations"
  on public.rider_current_locations for select
  using (public.has_shop_access(shop_id));

-- ==============================================================================
-- 4. dispatch_offers
-- ==============================================================================
alter table public.dispatch_offers enable row level security;

-- ไรเดอร์ดู offer ของตัวเอง + อัปเดตสถานะ (Accept/Reject)
drop policy if exists "Rider can view and respond to own offers" on public.dispatch_offers;
drop policy if exists "Rider can view own offers" on public.dispatch_offers;
create policy "Rider can view own offers"
  on public.dispatch_offers for select
  using (public.is_own_rider_id(rider_id));

drop policy if exists "Rider can respond to own offers" on public.dispatch_offers;
create policy "Rider can respond to own offers"
  on public.dispatch_offers for update
  using (public.is_own_rider_id(rider_id))
  with check (public.is_own_rider_id(rider_id));

-- Staff/Admin ดูและสร้าง offer ทั้งหมด (Dispatch Engine)
drop policy if exists "Shop staff can manage dispatch offers" on public.dispatch_offers;
create policy "Shop staff can manage dispatch offers"
  on public.dispatch_offers for all
  using (public.has_shop_access(shop_id))
  with check (public.has_shop_access(shop_id));

-- ==============================================================================
-- 5. delivery_events
-- ==============================================================================
alter table public.delivery_events enable row level security;

-- ไรเดอร์ insert event ของ order ที่รับผิดชอบ (assigned_rider_id = ตัวเอง)
drop policy if exists "Rider can insert own delivery events" on public.delivery_events;
create policy "Rider can insert own delivery events"
  on public.delivery_events for insert
  with check (
    public.is_own_rider_id(rider_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.assigned_rider_id = rider_id
    )
  );

-- ไรเดอร์ดู event ของ order ตัวเอง
drop policy if exists "Rider can view own delivery events" on public.delivery_events;
create policy "Rider can view own delivery events"
  on public.delivery_events for select
  using (public.is_own_rider_id(rider_id));

-- Staff/Admin ดูทั้งหมด
drop policy if exists "Shop staff can view all delivery events" on public.delivery_events;
create policy "Shop staff can view all delivery events"
  on public.delivery_events for select
  using (public.has_shop_access(shop_id));

-- ==============================================================================
-- 6. pod_uploads
-- ==============================================================================
alter table public.pod_uploads enable row level security;

-- ไรเดอร์ insert POD ของ order ที่รับผิดชอบ
drop policy if exists "Rider can insert own POD" on public.pod_uploads;
create policy "Rider can insert own POD"
  on public.pod_uploads for insert
  with check (
    public.is_own_rider_id(rider_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.assigned_rider_id = rider_id
    )
  );

-- ไรเดอร์ดู POD ของตัวเอง
drop policy if exists "Rider can view own POD" on public.pod_uploads;
create policy "Rider can view own POD"
  on public.pod_uploads for select
  using (public.is_own_rider_id(rider_id));

-- Staff/Admin ดูทั้งหมด + แก้ไข archive metadata ได้
drop policy if exists "Shop staff can manage POD uploads" on public.pod_uploads;
create policy "Shop staff can manage POD uploads"
  on public.pod_uploads for all
  using (public.has_shop_access(shop_id))
  with check (public.has_shop_access(shop_id));

-- ==============================================================================
-- 7. daily_settlements
-- ==============================================================================
alter table public.daily_settlements enable row level security;

-- Staff/Owner ดู Settlement ของร้าน
drop policy if exists "Shop staff can view settlements" on public.daily_settlements;
create policy "Shop staff can view settlements"
  on public.daily_settlements for select
  using (public.has_shop_access(shop_id));

-- Owner/Superadmin เท่านั้นที่สร้างและ Approve Settlement
drop policy if exists "Shop owner can manage settlements" on public.daily_settlements;
create policy "Shop owner can manage settlements"
  on public.daily_settlements for all
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- ==============================================================================
-- 8. settlement_line_items
-- ==============================================================================
alter table public.settlement_line_items enable row level security;

-- Staff/Owner ดูรายการ line items ของร้าน
drop policy if exists "Shop staff can view settlement line items" on public.settlement_line_items;
create policy "Shop staff can view settlement line items"
  on public.settlement_line_items for select
  using (public.has_shop_access(shop_id));

-- Owner/Superadmin จัดการ line items
drop policy if exists "Shop owner can manage settlement line items" on public.settlement_line_items;
create policy "Shop owner can manage settlement line items"
  on public.settlement_line_items for all
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- ==============================================================================
-- 9. rider_pool_ledger
-- ==============================================================================
alter table public.rider_pool_ledger enable row level security;

-- Staff/Owner ดู Ledger ของร้าน
drop policy if exists "Shop staff can view rider pool ledger" on public.rider_pool_ledger;
create policy "Shop staff can view rider pool ledger"
  on public.rider_pool_ledger for select
  using (public.has_shop_access(shop_id));

-- Owner/Superadmin เท่านั้นสร้าง/แก้ Ledger
drop policy if exists "Shop owner can manage rider pool ledger" on public.rider_pool_ledger;
create policy "Shop owner can manage rider pool ledger"
  on public.rider_pool_ledger for all
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
