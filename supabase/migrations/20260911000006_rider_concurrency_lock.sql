-- Serialize rider-scoped state changes so concurrent accepts cannot exceed
-- capacity and accepting an offer cannot race with closing the work session.

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
  v_rider_id uuid;
  v_now timestamptz := now();
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_action not in ('accept', 'reject') then
    raise exception 'INVALID_OFFER_ACTION';
  end if;

  -- Discover the rider before taking any row lock. Every operation scoped to
  -- this rider then takes the same transaction advisory lock first.
  select o.rider_id into v_rider_id
  from public.dispatch_offers o
  where o.id = p_offer_id;

  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.riders r
    where r.id = v_rider_id
      and r.auth_user_id = auth.uid()
      and r.status = 'active'
  ) then
    raise exception 'OFFER_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_rider_id::text, 0));

  select * into v_offer
  from public.dispatch_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  -- Re-check after waiting for the advisory lock so authorization and offer
  -- ownership cannot become stale while this transaction is queued.
  if v_offer.rider_id <> v_rider_id or not exists (
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

  -- Resolve identity without a row lock, then acquire the rider-scoped lock
  -- before locking the session. This matches the offer-response lock order.
  select s.id, s.rider_id
  into v_session_id, v_rider_id
  from public.rider_work_sessions s
  join public.riders r on r.id = s.rider_id
  where r.auth_user_id = auth.uid()
    and s.status = 'open'
    and (p_session_id is null or s.id = p_session_id)
  order by s.started_at desc
  limit 1;

  if not found then
    raise exception 'OPEN_WORK_SESSION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_rider_id::text, 0));

  select s.id, s.rider_id
  into v_session_id, v_rider_id
  from public.rider_work_sessions s
  join public.riders r on r.id = s.rider_id
  where s.id = v_session_id
    and r.auth_user_id = auth.uid()
    and s.status = 'open'
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
