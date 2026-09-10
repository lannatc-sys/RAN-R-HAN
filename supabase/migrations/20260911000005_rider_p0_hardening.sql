-- ==============================================================================
-- Rider System Phase 1 — P0 security and atomicity hardening
-- Additive migration: the preceding rider migrations have already been applied.
-- ==============================================================================

-- Internal helpers run only through trusted server code. SECURITY DEFINER bypasses
-- RLS, so do not leave the PostgreSQL default EXECUTE grant on these functions.
revoke all on function public.find_available_riders(
  uuid, double precision, double precision, double precision, uuid[]
) from public, anon, authenticated;
grant execute on function public.find_available_riders(
  uuid, double precision, double precision, double precision, uuid[]
) to service_role;

revoke all on function public.get_rider_active_order_count(uuid)
  from public, anon, authenticated;
grant execute on function public.get_rider_active_order_count(uuid)
  to service_role;

revoke all on function public.create_daily_settlement_draft(uuid, date)
  from public, anon, authenticated;
grant execute on function public.create_daily_settlement_draft(uuid, date)
  to service_role;

-- Replace the undocumented 80/20 placeholder with the locked Phase-1 base rate:
-- rider receives 15.00 for the first 5 km, funded by 7.50 shop portion plus the
-- customer delivery charge. Unknown/>5 km rates stay visible as exceptions.
create unique index if not exists uq_settlement_line_item_order
  on public.settlement_line_items(settlement_id, order_id);

create or replace function public.create_daily_settlement_draft(
  p_shop_id uuid,
  p_settlement_date date default ((now() at time zone 'Asia/Bangkok')::date - 1)
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settlement_id uuid;
begin
  insert into public.daily_settlements (shop_id, settlement_date, status)
  values (p_shop_id, p_settlement_date, 'draft')
  on conflict (shop_id, settlement_date) do nothing
  returning id into v_settlement_id;

  if v_settlement_id is null then
    select id into v_settlement_id
    from public.daily_settlements
    where shop_id = p_shop_id and settlement_date = p_settlement_date;
    return v_settlement_id;
  end if;

  insert into public.settlement_line_items (
    settlement_id,
    order_id,
    rider_id,
    shop_id,
    delivery_fee,
    shop_portion,
    rider_payout,
    rider_pool_amount,
    flags,
    note
  )
  select
    v_settlement_id,
    o.id,
    o.assigned_rider_id,
    o.shop_id,
    coalesce(o.delivery_fee, 0),
    7.50,
    15.00,
    greatest(coalesce(o.delivery_fee, 0) + 7.50 - 15.00, 0),
    case
      when o.assigned_rider_id is null then array['PENDING_RIDER']::text[]
      when o.estimated_distance_km is null or o.estimated_distance_km > 5
        then array['PENDING_RATE_CARD']::text[]
      when coalesce(o.delivery_fee, 0) + 7.50 < 15.00
        then array['FUNDING_SHORTFALL']::text[]
      else '{}'::text[]
    end,
    case
      when o.estimated_distance_km is null or o.estimated_distance_km > 5
        then 'ค่าเกิน 5 กม. ยังไม่มี Rate Card — ต้องตรวจและปรับก่อนอนุมัติ'
      else null
    end
  from public.orders o
  join lateral (
    select e.server_received_at
    from public.delivery_events e
    where e.order_id = o.id
      and e.event_type in ('delivered', 'unreachable_drop')
    order by e.server_received_at desc
    limit 1
  ) delivered on true
  where o.shop_id = p_shop_id
    and o.dispatch_status = 'delivered'
    and (delivered.server_received_at at time zone 'Asia/Bangkok')::date = p_settlement_date;

  update public.daily_settlements s
  set total_orders = totals.total_orders,
      total_delivery_fee = totals.total_delivery_fee,
      total_rider_payout = totals.total_rider_payout,
      total_rider_pool = totals.total_rider_pool,
      exception_count = totals.exception_count
  from (
    select
      count(*)::integer as total_orders,
      coalesce(sum(li.delivery_fee), 0) as total_delivery_fee,
      coalesce(sum(li.rider_payout), 0) as total_rider_payout,
      coalesce(sum(li.rider_pool_amount), 0) as total_rider_pool,
      count(*) filter (where cardinality(li.flags) > 0)::integer as exception_count
    from public.settlement_line_items li
    where li.settlement_id = v_settlement_id
  ) totals
  where s.id = v_settlement_id;

  return v_settlement_id;
end;
$$;

revoke all on function public.create_daily_settlement_draft(uuid, date)
  from public, anon, authenticated;
grant execute on function public.create_daily_settlement_draft(uuid, date)
  to service_role;

-- A rider may inspect an offer, but may not mutate the underlying row directly.
-- Accept/reject now goes through respond_to_dispatch_offer(), which owns the lock,
-- timeout check, work-session check and order assignment in one transaction.
drop policy if exists "Rider can respond to own offers" on public.dispatch_offers;

-- Critical delivery transitions must not be insertable independently of their
-- POD/order updates. finalize_rider_delivery_event() is the sole rider write path.
drop policy if exists "Rider can insert own delivery events" on public.delivery_events;
drop policy if exists "Rider can insert own POD" on public.pod_uploads;

-- Work-session closure is transactional. Keep direct read/start permissions, but
-- remove direct update/delete so Close System cannot partially succeed.
drop policy if exists "Rider can manage own work sessions" on public.rider_work_sessions;
drop policy if exists "Rider can view own work sessions" on public.rider_work_sessions;
create policy "Rider can view own work sessions"
  on public.rider_work_sessions for select
  using (public.is_own_rider_id(rider_id));

drop policy if exists "Rider can start own work sessions" on public.rider_work_sessions;
create policy "Rider can start own work sessions"
  on public.rider_work_sessions for insert
  with check (
    public.is_own_rider_id(rider_id)
    and status = 'open'
    and closed_at is null
    and shop_id = (select r.shop_id from public.riders r where r.id = rider_id)
  );

-- Database-level race guard for two simultaneous Start Work requests.
create unique index if not exists uq_rider_one_open_work_session
  on public.rider_work_sessions(rider_id)
  where status = 'open';

-- POD objects are private. Reading must be mediated by a platform endpoint using
-- the service role after checking the caller; riders/staff receive no direct read.
drop policy if exists "Rider can read own shop POD" on storage.objects;
drop policy if exists "Shop staff can read POD" on storage.objects;

-- Limit direct object uploads to the rider's currently assigned order. Metadata is
-- still registered only by the authenticated platform route using service_role.
drop policy if exists "Rider can upload POD to own shop folder" on storage.objects;
create policy "Rider can upload POD to assigned order folder"
  on storage.objects for insert
  with check (
    bucket_id = 'pod-uploads'
    and (storage.foldername(name))[1] = 'pod'
    and public.is_rider_of_shop(((storage.foldername(name))[2])::uuid)
    and exists (
      select 1
      from public.orders o
      join public.riders r on r.id = o.assigned_rider_id
      where o.id = ((storage.foldername(name))[3])::uuid
        and o.shop_id = ((storage.foldername(name))[2])::uuid
        and r.auth_user_id = auth.uid()
        and o.dispatch_status in ('assigned', 'in_transit')
    )
  );

create or replace function public.respond_to_dispatch_offer(
  p_offer_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_offer public.dispatch_offers%rowtype;
  v_order public.orders%rowtype;
  v_now timestamptz := now();
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_action not in ('accept', 'reject') then
    raise exception 'INVALID_OFFER_ACTION';
  end if;

  select * into v_offer
  from public.dispatch_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.riders r
    where r.id = v_offer.rider_id
      and r.auth_user_id = auth.uid()
      and r.status = 'active'
  ) then
    raise exception 'OFFER_FORBIDDEN';
  end if;

  if v_offer.status <> 'offered' then
    raise exception 'OFFER_ALREADY_RESPONDED';
  end if;

  if v_offer.timeout_at is not null and v_now > v_offer.timeout_at then
    update public.dispatch_offers
    set status = 'timed_out', responded_at = v_now
    where id = v_offer.id and status = 'offered';

    return jsonb_build_object('success', false, 'code', 'OFFER_EXPIRED');
  end if;

  if p_action = 'reject' then
    update public.dispatch_offers
    set status = 'rejected', responded_at = v_now
    where id = v_offer.id;

    return jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'responded_at', v_now
    );
  end if;

  if not exists (
    select 1 from public.rider_work_sessions s
    where s.rider_id = v_offer.rider_id and s.status = 'open'
  ) then
    raise exception 'WORK_SESSION_REQUIRED';
  end if;

  select count(*)::integer into v_active_count
  from public.orders o
  where o.assigned_rider_id = v_offer.rider_id
    and o.dispatch_status in ('assigned', 'in_transit');

  if v_active_count >= 2 then
    raise exception 'RIDER_CAPACITY_REACHED';
  end if;

  select * into v_order
  from public.orders
  where id = v_offer.order_id
  for update;

  if not found
     or v_order.assigned_rider_id is not null
     or v_order.dispatch_status not in ('pending', 'dispatching') then
    raise exception 'ORDER_ALREADY_ASSIGNED';
  end if;

  update public.dispatch_offers
  set status = 'accepted', responded_at = v_now
  where id = v_offer.id;

  update public.orders
  set assigned_rider_id = v_offer.rider_id,
      dispatch_status = 'assigned'
  where id = v_offer.order_id;

  return jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'responded_at', v_now
  );
end;
$$;

revoke all on function public.respond_to_dispatch_offer(uuid, text)
  from public, anon;
grant execute on function public.respond_to_dispatch_offer(uuid, text)
  to authenticated, service_role;

create or replace function public.close_rider_work_session(
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session_id uuid;
  v_rider_id uuid;
  v_closed_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select s.id, s.rider_id
  into v_session_id, v_rider_id
  from public.rider_work_sessions s
  join public.riders r on r.id = s.rider_id
  where r.auth_user_id = auth.uid()
    and s.status = 'open'
    and (p_session_id is null or s.id = p_session_id)
  order by s.started_at desc
  limit 1
  for update of s;

  if not found then
    raise exception 'OPEN_WORK_SESSION_NOT_FOUND';
  end if;

  update public.rider_work_sessions
  set status = 'closed', closed_at = v_closed_at
  where id = v_session_id and status = 'open';

  delete from public.rider_current_locations
  where rider_id = v_rider_id;

  update public.dispatch_offers
  set status = 'rejected', responded_at = v_closed_at
  where rider_id = v_rider_id and status = 'offered';

  return jsonb_build_object(
    'session_id', v_session_id,
    'closed_at', v_closed_at
  );
end;
$$;

revoke all on function public.close_rider_work_session(uuid)
  from public, anon;
grant execute on function public.close_rider_work_session(uuid)
  to authenticated, service_role;

create or replace function public.finalize_rider_delivery_event(
  p_order_id uuid,
  p_event_type text,
  p_gps_lat double precision default null,
  p_gps_lng double precision default null,
  p_note text default null,
  p_pod_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rider_id uuid;
  v_shop_id uuid;
  v_last_event public.delivery_event_type;
  v_event_type public.delivery_event_type;
  v_event_id uuid;
  v_received_at timestamptz := now();
  v_transition_valid boolean := false;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  begin
    v_event_type := p_event_type::public.delivery_event_type;
  exception when invalid_text_representation then
    raise exception 'INVALID_DELIVERY_EVENT';
  end;

  -- Locking the order serializes state transitions for this delivery.
  select o.assigned_rider_id, o.shop_id
  into v_rider_id, v_shop_id
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.riders r
    where r.id = v_rider_id
      and r.auth_user_id = auth.uid()
      and r.status = 'active'
  ) then
    raise exception 'ORDER_FORBIDDEN';
  end if;

  select e.event_type into v_last_event
  from public.delivery_events e
  where e.order_id = p_order_id and e.rider_id = v_rider_id
  order by e.server_received_at desc, e.id desc
  limit 1;

  if v_event_type in ('breakdown', 'unreachable_drop') then
    v_transition_valid := v_last_event is null
      or v_last_event not in ('delivered', 'unreachable_drop');
  elsif v_last_event is null then
    v_transition_valid := v_event_type = 'departed_to_shop';
  elsif v_last_event = 'departed_to_shop' then
    v_transition_valid := v_event_type = 'arrived_at_shop';
  elsif v_last_event = 'arrived_at_shop' then
    v_transition_valid := v_event_type = 'picked_up';
  elsif v_last_event in ('picked_up', 'breakdown') then
    v_transition_valid := v_event_type = 'departed_to_customer';
  elsif v_last_event = 'departed_to_customer' then
    v_transition_valid := v_event_type = 'delivered';
  end if;

  if not v_transition_valid then
    raise exception 'INVALID_EVENT_TRANSITION';
  end if;

  if v_event_type in ('delivered', 'unreachable_drop') then
    if p_pod_id is null then
      raise exception 'POD_REQUIRED';
    end if;

    perform 1
    from public.pod_uploads p
    where p.id = p_pod_id
      and p.order_id = p_order_id
      and p.rider_id = v_rider_id
      and p.shop_id = v_shop_id
      and p.event_type = v_event_type
      and p.delivery_event_id is null
    for update;

    if not found then
      raise exception 'INVALID_OR_USED_POD';
    end if;
  end if;

  insert into public.delivery_events (
    order_id, rider_id, shop_id, event_type,
    server_received_at, gps_lat, gps_lng, note
  ) values (
    p_order_id, v_rider_id, v_shop_id, v_event_type,
    v_received_at, p_gps_lat, p_gps_lng, p_note
  )
  returning id into v_event_id;

  if p_pod_id is not null and v_event_type in ('delivered', 'unreachable_drop') then
    update public.pod_uploads
    set delivery_event_id = v_event_id
    where id = p_pod_id and delivery_event_id is null;

    if not found then
      raise exception 'POD_LINK_CONFLICT';
    end if;
  end if;

  if v_event_type = 'picked_up' then
    update public.orders set dispatch_status = 'in_transit' where id = p_order_id;
  elsif v_event_type in ('delivered', 'unreachable_drop') then
    update public.orders set dispatch_status = 'delivered' where id = p_order_id;
  end if;

  return jsonb_build_object(
    'event_id', v_event_id,
    'server_received_at', v_received_at
  );
end;
$$;

revoke all on function public.finalize_rider_delivery_event(
  uuid, text, double precision, double precision, text, uuid
) from public, anon;
grant execute on function public.finalize_rider_delivery_event(
  uuid, text, double precision, double precision, text, uuid
) to authenticated, service_role;
