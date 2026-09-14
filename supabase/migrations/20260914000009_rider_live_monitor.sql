-- ==============================================================================
-- RAN-R-HAN: read-only Rider Live Monitor snapshot for superadmin
--
-- Returns one row per rider, including riders without an open session or GPS.
-- The RPC deliberately omits phone numbers, customer details and delivery address.
-- ==============================================================================

begin;

create or replace function public.get_rider_live_monitor_snapshot(
  p_shop_id uuid default null
)
returns table (
  rider_id uuid,
  shop_id uuid,
  shop_name text,
  display_name text,
  rider_status text,
  work_session_id uuid,
  session_started_at timestamptz,
  lat double precision,
  lng double precision,
  accuracy numeric,
  heading numeric,
  speed numeric,
  location_updated_at timestamptz,
  gps_age_seconds bigint,
  location_is_stale boolean,
  outside_area_since timestamptz,
  inside_work_area boolean,
  service_area_enabled boolean,
  uses_rider_polygon boolean,
  active_order_id uuid,
  active_order_no text,
  active_order_dispatch_status text,
  active_offer_id uuid,
  active_offer_order_id uuid,
  active_offer_status text,
  active_offer_timeout_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  return query
  select
    r.id,
    s.id,
    s.name,
    r.display_name,
    r.status::text,
    work_session.id,
    work_session.started_at,
    location.lat,
    location.lng,
    location.accuracy,
    location.heading,
    location.speed,
    location.updated_at,
    case
      when location.updated_at is null then null
      else greatest(
        0,
        floor(extract(epoch from (statement_timestamp() - location.updated_at)))
      )::bigint
    end,
    location.updated_at is null
      or location.updated_at < statement_timestamp() - interval '90 seconds',
    location.outside_area_since,
    case
      when location.rider_id is null then null
      when not coalesce(s.service_area_enabled, false) then true
      else public.is_point_in_shop_area(
        s.rider_work_area_polygon,
        s.shop_lat,
        s.shop_lng,
        s.rider_work_radius_m,
        location.lat,
        location.lng
      )
    end,
    coalesce(s.service_area_enabled, false),
    s.rider_work_area_polygon is not null,
    active_order.id,
    active_order.order_no,
    active_order.dispatch_status,
    active_offer.id,
    active_offer.order_id,
    active_offer.status,
    active_offer.timeout_at
  from public.riders r
  join public.shops s on s.id = r.shop_id
  left join lateral (
    select session.id, session.started_at
    from public.rider_work_sessions session
    where session.rider_id = r.id
      and session.shop_id = r.shop_id
      and session.status = 'open'
    order by session.started_at desc
    limit 1
  ) work_session on true
  left join public.rider_current_locations location
    on location.rider_id = r.id
   and location.shop_id = r.shop_id
  left join lateral (
    select orders.id, orders.order_no, orders.dispatch_status
    from public.orders orders
    where orders.assigned_rider_id = r.id
      and orders.shop_id = r.shop_id
      and orders.dispatch_status in ('assigned', 'in_transit')
    order by orders.created_at desc
    limit 1
  ) active_order on true
  left join lateral (
    select offers.id, offers.order_id, offers.status::text, offers.timeout_at
    from public.dispatch_offers offers
    where offers.rider_id = r.id
      and offers.shop_id = r.shop_id
      and offers.status = 'offered'
      and (offers.timeout_at is null or offers.timeout_at > statement_timestamp())
    order by offers.offered_at desc
    limit 1
  ) active_offer on true
  where p_shop_id is null or s.id = p_shop_id
  order by s.name, r.display_name, r.id;
end;
$$;

revoke all on function public.get_rider_live_monitor_snapshot(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_rider_live_monitor_snapshot(uuid)
  to authenticated;

comment on function public.get_rider_live_monitor_snapshot(uuid) is
  'Superadmin-only read snapshot for Rider Live Monitor; intentionally excludes phone and customer PII.';

commit;
