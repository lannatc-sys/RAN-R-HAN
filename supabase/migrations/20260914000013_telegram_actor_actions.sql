-- ==============================================================================
-- RAN-R-HAN: Telegram actor wrappers (operational gateway callbacks)
--
-- ปัญหา: RPC หลัก (respond_to_dispatch_offer, set_shop_open_status) ตรวจสิทธิ์
-- ผ่าน auth.uid() ซึ่งมีเฉพาะใน HTTP session ของผู้ใช้จริง ไม่มีในบริบทของ
-- Telegram webhook (service_role) การคัดลอก logic หลักมาเขียนใหม่เสี่ยง
-- diverge (advisory lock / concurrency guard) จึงใช้วิธี delegate แทน:
--
--  1. ตรวจ ownership ด้วย user_id ชัดเจนก่อน (FORBIDDEN เร็ว ข้อความชัด)
--  2. ตั้ง request.jwt.claim.sub เป็น actor ภายใน transaction เดียวกัน
--     (เทคนิคเดียวกับ integration tests) แล้วเรียก RPC ตัวจริง
--  3. logic ล็อก/validate ทั้งหมดยังเป็นของ core เหมือนเดิม ไม่ duplicate
--
-- ทั้งสองฟังก์ชันเป็น SECURITY DEFINER, grant ให้ service_role เท่านั้น
-- (revoke จาก public/anon/authenticated) — webhook เรียกผ่าน admin client
-- หลังจาก resolve verified identity และตรวจ ownership ใน TypeScript แล้ว
-- Dependency: dispatch_offers/riders (rider_system), shops/users/shop_members
-- ==============================================================================

begin;

-- 1. Rider accepts/rejects their own dispatch offer --------------------------------
create or replace function public.telegram_offer_respond(
  p_actor uuid,
  p_offer_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  if p_action is null or p_action not in ('accept', 'reject') then
    raise exception 'INVALID_OFFER_ACTION';
  end if;

  -- Ownership ก่อน delegate: offer ต้อง offered, ไม่หมดอายุ, เป็นของ rider ของ actor
  if not exists (
    select 1
      from public.dispatch_offers o
      join public.riders r on r.id = o.rider_id
     where o.id = p_offer_id
       and r.auth_user_id = p_actor
       and o.status = 'offered'
       and (o.timeout_at is null or o.timeout_at > statement_timestamp())
  ) then
    raise exception 'FORBIDDEN_OFFER';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  select public.respond_to_dispatch_offer(p_offer_id, p_action) into v_result;
  return v_result;
end;
$$;

revoke all on function public.telegram_offer_respond(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.telegram_offer_respond(uuid, uuid, text)
  to service_role;

comment on function public.telegram_offer_respond(uuid, uuid, text) is
  'Telegram-only: verified rider identity responds to own dispatch offer; delegates to respond_to_dispatch_offer.';

-- 2. Shop owner toggles open/close --------------------------------------------------
create or replace function public.telegram_shop_set_open(
  p_actor uuid,
  p_shop_id uuid,
  p_is_open boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  if p_is_open is null then
    raise exception 'INVALID_SHOP_OPEN_STATUS';
  end if;

  -- Ownership ก่อน delegate: superadmin หรือ owner ของร้าน (แถว users หรือ shop_members)
  if not exists (
    select 1
      from public.users u
     where u.id = p_actor
       and (u.role = 'superadmin' or (u.shop_id = p_shop_id and u.role = 'owner'))
  ) and not exists (
    select 1
      from public.shop_members m
     where m.user_id = p_actor
       and m.shop_id = p_shop_id
       and m.role = 'owner'
       and m.is_active
  ) then
    raise exception 'FORBIDDEN_SHOP';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  select public.set_shop_open_status(p_shop_id, p_is_open) into v_result;
  return v_result;
end;
$$;

revoke all on function public.telegram_shop_set_open(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.telegram_shop_set_open(uuid, uuid, boolean)
  to service_role;

comment on function public.telegram_shop_set_open(uuid, uuid, boolean) is
  'Telegram-only: verified shop owner toggles own shop open status; delegates to set_shop_open_status.';

commit;
