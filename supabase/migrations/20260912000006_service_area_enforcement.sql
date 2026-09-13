-- ==============================================================================
-- RAN-R-HAN: Service-area and rider-work-area enforcement
-- Safe default: disabled for every existing shop until coordinates are configured.
-- ==============================================================================

alter table public.shops
  add column if not exists service_area_enabled boolean not null default false,
  add column if not exists service_radius_m numeric not null default 5000,
  add column if not exists rider_work_radius_m numeric not null default 10000;

alter table public.shops
  alter column service_radius_m set default 5000,
  alter column rider_work_radius_m set default 10000;

update public.shops
set service_radius_m = coalesce(service_radius_m, 5000),
    rider_work_radius_m = coalesce(rider_work_radius_m, 10000);

alter table public.shops
  alter column service_radius_m set not null,
  alter column rider_work_radius_m set not null;

alter table public.shops
  drop constraint if exists check_service_area_configuration;

alter table public.shops
  add constraint check_service_area_configuration check (
    service_radius_m > 0
    and service_radius_m <= 200000
    and rider_work_radius_m > 0
    and rider_work_radius_m <= 200000
    and (
      not service_area_enabled
      or (
        shop_lat is not null
        and shop_lng is not null
        and shop_lat between -90 and 90
        and shop_lng between -180 and 180
      )
    )
  );

alter table public.rider_current_locations
  add column if not exists outside_area_since timestamptz;

create index if not exists idx_rider_locations_outside_area
  on public.rider_current_locations(outside_area_since)
  where outside_area_since is not null;

-- The service-area state machine is authoritative at RPC boundaries. Remove
-- legacy direct-write paths that can bypass work-session checks and locks.
drop policy if exists "Rider can upsert own location"
  on public.rider_current_locations;
revoke insert, update, delete on table public.rider_current_locations
  from anon, authenticated;

-- Shop mutations are performed by the server-side admin actions or the narrow
-- SECURITY DEFINER RPCs below. Direct authenticated updates could otherwise
-- change geo/radius columns without re-evaluating active rider timers.
revoke update on table public.shops from anon, authenticated;

-- Safe rollout preflight: Verify no legacy duplicate (shop_id, auth_user_id) pairs exist before creating the unique index.
-- If duplicates are found, fail closed with a clear diagnostic message requiring manual operator resolution,
-- preventing silent deletion, arbitrary deduplication, or unexpected index creation failure.
do $$
declare
  v_duplicate_count integer;
begin
  select count(*) into v_duplicate_count
  from (
    select shop_id, auth_user_id
    from public.riders
    where auth_user_id is not null
    group by shop_id, auth_user_id
    having count(*) > 1
  ) dups;

  if v_duplicate_count > 0 then
    raise exception 'MIGRATION_PREFLIGHT_FAILED: Found % duplicate rider entries for (shop_id, auth_user_id). Manual deduplication required before creating unique index uq_rider_shop_auth_user.', v_duplicate_count;
  end if;
end;
$$;

create unique index if not exists uq_rider_shop_auth_user
  on public.riders(shop_id, auth_user_id)
  where auth_user_id is not null;

create or replace function public.calc_distance_meters(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = public, extensions
as $$
  select extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(lng1, lat1), 4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(lng2, lat2), 4326)::extensions.geography
  );
$$;

revoke all on function public.calc_distance_meters(double precision, double precision, double precision, double precision)
  from public, anon, authenticated, service_role;

create or replace function public.set_shop_service_area_settings(
  p_shop_id uuid,
  p_enabled boolean,
  p_service_radius_m numeric,
  p_rider_work_radius_m numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_shop public.shops%rowtype;
  v_rider record;
  v_location record;
  v_dist double precision;
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.has_shop_access(p_shop_id) then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  if p_service_radius_m is null or p_service_radius_m <= 0 or p_service_radius_m > 200000
     or p_rider_work_radius_m is null or p_rider_work_radius_m <= 0 or p_rider_work_radius_m > 200000 then
    raise exception 'INVALID_SERVICE_AREA_RADIUS';
  end if;

  -- Configuration changes take the exclusive shop lock. Rider reports and
  -- starts take the shared form of this lock before their rider lock, which
  -- prevents both stale reads and new location rows during re-evaluation.
  perform pg_advisory_xact_lock(hashtextextended('shop:' || p_shop_id::text, 0));

  select * into v_shop
  from public.shops
  where id = p_shop_id
  for update;

  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  if p_enabled and (v_shop.shop_lat is null or v_shop.shop_lng is null) then
    raise exception 'SHOP_COORDINATES_REQUIRED';
  end if;

  -- Update shop settings only if changed, and safely handle outside_area_since:
  -- 1) If settings did not change, NEVER reset outside_area_since.
  -- 2) If enforcement is disabled, clear outside_area_since to null.
  -- 3) If coordinates/radii changed, re-evaluate against new boundary:
  --    - riders inside boundary get outside_area_since = null
  --    - riders still outside boundary PRESERVE their existing outside_area_since (coalesce) to prevent bypassing the 15-minute rule
  if (v_shop.service_area_enabled is distinct from p_enabled)
     or (v_shop.service_radius_m is distinct from p_service_radius_m)
     or (v_shop.rider_work_radius_m is distinct from p_rider_work_radius_m) then

    update public.shops
    set service_area_enabled = p_enabled,
        service_radius_m = p_service_radius_m,
        rider_work_radius_m = p_rider_work_radius_m,
        updated_at = now()
    where id = p_shop_id;

    for v_rider in
      select rider_id
      from public.rider_current_locations
      where shop_id = p_shop_id
      order by rider_id
    loop
      perform pg_advisory_xact_lock(hashtextextended(v_rider.rider_id::text, 0));

      -- The cursor row was discovered before the rider lock. Re-read and row
      -- lock it now so calculations never use a stale GPS/timer snapshot.
      select rider_id, lat, lng, outside_area_since
      into v_location
      from public.rider_current_locations
      where rider_id = v_rider.rider_id
        and shop_id = p_shop_id
      for update;

      if not found then
        continue;
      end if;

      if not p_enabled then
        update public.rider_current_locations
        set outside_area_since = null
        where rider_id = v_location.rider_id
          and outside_area_since is not null;
        continue;
      end if;

      v_dist := public.calc_distance_meters(
        v_shop.shop_lat,
        v_shop.shop_lng,
        v_location.lat,
        v_location.lng
      );

      if v_dist <= p_rider_work_radius_m then
        update public.rider_current_locations
        set outside_area_since = null
        where rider_id = v_location.rider_id
          and outside_area_since is not null;
      else
        update public.rider_current_locations
        set outside_area_since = coalesce(v_location.outside_area_since, v_now)
        where rider_id = v_location.rider_id;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'service_area_enabled', p_enabled,
    'service_radius_m', p_service_radius_m,
    'rider_work_radius_m', p_rider_work_radius_m
  );
end;
$$;

revoke all on function public.set_shop_service_area_settings(uuid, boolean, numeric, numeric)
  from public, anon;
grant execute on function public.set_shop_service_area_settings(uuid, boolean, numeric, numeric)
  to authenticated;

create or replace function public.enforce_service_area_for_new_orders()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_shop public.shops%rowtype;
  v_dist double precision;
begin
  if new.type <> 'delivery' then
    return new;
  end if;

  select * into v_shop
  from public.shops
  where id = new.shop_id
  for share;

  if coalesce(v_shop.service_area_enabled, false) then
    if new.delivery_lat is null or new.delivery_lng is null
       or new.delivery_lat < -90 or new.delivery_lat > 90
       or new.delivery_lng < -180 or new.delivery_lng > 180 then
      raise exception 'OUTSIDE_SERVICE_AREA: อยู่นอกเขตบริการ กรุณารอแผนการขยายการให้บริการ';
    end if;

    -- Defense-in-depth: calc_distance_meters is STRICT — NULL shop coordinates
    -- cause it to return NULL, making (NULL > radius) evaluate to NULL (unknown),
    -- which silently allows the order through. The DB constraint should prevent
    -- this state, but we guard here as a second layer.
    if v_shop.shop_lat is null or v_shop.shop_lng is null then
      raise exception 'OUTSIDE_SERVICE_AREA: อยู่นอกเขตบริการ กรุณารอแผนการขยายการให้บริการ';
    end if;

    v_dist := public.calc_distance_meters(
      v_shop.shop_lat,
      v_shop.shop_lng,
      new.delivery_lat,
      new.delivery_lng
    );

    if v_dist > v_shop.service_radius_m then
      raise exception 'OUTSIDE_SERVICE_AREA: อยู่นอกเขตบริการ กรุณารอแผนการขยายการให้บริการ';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_service_area_for_new_orders()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_enforce_service_area_for_new_orders on public.orders;
create trigger trg_enforce_service_area_for_new_orders
  before insert or update of type, shop_id, delivery_lat, delivery_lng on public.orders
  for each row execute function public.enforce_service_area_for_new_orders();

-- Single rider-scoped close primitive shared by manual, GPS, and cron paths.
create or replace function public.close_rider_work_session_internal(
  p_rider_id uuid,
  p_expected_session_id uuid default null,
  p_closed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_rider_id::text, 0));

  select s.id into v_session_id
  from public.rider_work_sessions s
  where s.rider_id = p_rider_id
    and s.status = 'open'
    and (p_expected_session_id is null or s.id = p_expected_session_id)
  order by s.started_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('closed', false);
  end if;

  update public.rider_work_sessions
  set status = 'closed', closed_at = p_closed_at
  where id = v_session_id and status = 'open';

  delete from public.rider_current_locations
  where rider_id = p_rider_id;

  update public.dispatch_offers
  set status = 'rejected', responded_at = p_closed_at
  where rider_id = p_rider_id and status = 'offered';

  return jsonb_build_object(
    'closed', true,
    'session_id', v_session_id,
    'closed_at', p_closed_at
  );
end;
$$;

revoke all on function public.close_rider_work_session_internal(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

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
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select s.id, s.rider_id into v_session_id, v_rider_id
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

  v_result := public.close_rider_work_session_internal(v_rider_id, v_session_id, now());
  if not coalesce((v_result ->> 'closed')::boolean, false) then
    raise exception 'OPEN_WORK_SESSION_NOT_FOUND';
  end if;

  return v_result - 'closed';
end;
$$;

revoke all on function public.close_rider_work_session(uuid)
  from public, anon;
grant execute on function public.close_rider_work_session(uuid)
  to authenticated, service_role;

create or replace function public.start_rider_work_session(
  p_shop_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_device_info jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rider_id uuid;
  v_shop public.shops%rowtype;
  v_dist double precision;
  v_session public.rider_work_sessions%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  select id into v_rider_id
  from public.riders
  where auth_user_id = auth.uid()
    and shop_id = p_shop_id
    and status = 'active';

  if not found then
    raise exception 'RIDER_NOT_FOUND_OR_INACTIVE';
  end if;

  perform pg_advisory_xact_lock_shared(hashtextextended('shop:' || p_shop_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_rider_id::text, 0));

  if not exists (
    select 1 from public.riders
    where id = v_rider_id
      and auth_user_id = auth.uid()
      and shop_id = p_shop_id
      and status = 'active'
  ) then
    raise exception 'RIDER_NOT_FOUND_OR_INACTIVE';
  end if;

  select * into v_session
  from public.rider_work_sessions
  where rider_id = v_rider_id and status = 'open'
  order by started_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'session_id', v_session.id,
      'started_at', v_session.started_at,
      'resumed', true
    );
  end if;

  select * into v_shop
  from public.shops
  where id = p_shop_id;

  if v_shop.service_area_enabled then
    v_dist := public.calc_distance_meters(v_shop.shop_lat, v_shop.shop_lng, p_lat, p_lng);
    if v_dist > v_shop.rider_work_radius_m then
      raise exception 'OUTSIDE_WORK_AREA: คุณอยู่นอกเขตพื้นที่การทำงาน กรุณากลับเข้าเขตพื้นที่ก่อนเริ่มงาน';
    end if;
  end if;

  insert into public.rider_work_sessions (rider_id, shop_id, started_at, status, device_info)
  values (v_rider_id, p_shop_id, v_now, 'open', p_device_info)
  returning * into v_session;

  return jsonb_build_object(
    'session_id', v_session.id,
    'started_at', v_session.started_at,
    'resumed', false
  );
end;
$$;

revoke all on function public.start_rider_work_session(uuid, double precision, double precision, jsonb)
  from public, anon;
grant execute on function public.start_rider_work_session(uuid, double precision, double precision, jsonb)
  to authenticated;

create or replace function public.report_rider_location(
  p_shop_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy numeric default null,
  p_heading numeric default null,
  p_speed numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rider_id uuid;
  v_work_session_id uuid;
  v_shop public.shops%rowtype;
  v_now timestamptz := now();
  v_dist double precision;
  v_inside_area boolean := true;
  v_auto_closed boolean := false;
  v_outside_area_since timestamptz;
  v_close_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  select id into v_rider_id
  from public.riders
  where auth_user_id = auth.uid()
    and shop_id = p_shop_id
    and status = 'active';

  if not found then
    raise exception 'RIDER_NOT_FOUND_OR_INACTIVE';
  end if;

  perform pg_advisory_xact_lock_shared(hashtextextended('shop:' || p_shop_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_rider_id::text, 0));

  if not exists (
    select 1 from public.riders
    where id = v_rider_id
      and auth_user_id = auth.uid()
      and shop_id = p_shop_id
      and status = 'active'
  ) then
    raise exception 'RIDER_NOT_FOUND_OR_INACTIVE';
  end if;

  -- Select the actual current session only after taking the rider lock.
  select s.id into v_work_session_id
  from public.rider_work_sessions s
  where s.rider_id = v_rider_id and s.status = 'open'
  order by s.started_at desc
  limit 1
  for update;

  if not found then
    raise exception 'WORK_SESSION_REQUIRED';
  end if;

  select * into v_shop
  from public.shops
  where id = p_shop_id;

  select outside_area_since into v_outside_area_since
  from public.rider_current_locations
  where rider_id = v_rider_id;

  if v_shop.service_area_enabled then
    v_dist := public.calc_distance_meters(v_shop.shop_lat, v_shop.shop_lng, p_lat, p_lng);
    if v_dist <= v_shop.rider_work_radius_m then
      v_inside_area := true;
      v_outside_area_since := null;
    else
      v_inside_area := false;
      v_outside_area_since := coalesce(v_outside_area_since, v_now);
    end if;
  else
    v_inside_area := true;
    v_outside_area_since := null;
  end if;

  insert into public.rider_current_locations (
    rider_id, shop_id, work_session_id,
    lat, lng, accuracy, heading, speed, updated_at, outside_area_since
  )
  values (
    v_rider_id, p_shop_id, v_work_session_id,
    p_lat, p_lng, p_accuracy, p_heading, p_speed, v_now, v_outside_area_since
  )
  on conflict (rider_id) do update
  set shop_id = excluded.shop_id,
      work_session_id = excluded.work_session_id,
      lat = excluded.lat,
      lng = excluded.lng,
      accuracy = excluded.accuracy,
      heading = excluded.heading,
      speed = excluded.speed,
      updated_at = excluded.updated_at,
      outside_area_since = excluded.outside_area_since;

  if not v_inside_area
     and v_outside_area_since is not null
     and (v_now - v_outside_area_since) >= interval '15 minutes' then
    v_close_result := public.close_rider_work_session_internal(
      v_rider_id,
      v_work_session_id,
      v_now
    );
    v_auto_closed := coalesce((v_close_result ->> 'closed')::boolean, false);
  end if;

  return jsonb_build_object(
    'inside_area', v_inside_area,
    'outside_area_since', v_outside_area_since,
    'auto_closed', v_auto_closed,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.report_rider_location(uuid, double precision, double precision, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.report_rider_location(uuid, double precision, double precision, numeric, numeric, numeric)
  to authenticated;

create or replace function public.sweep_expired_rider_geofence_sessions()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_candidate record;
  v_location record;
  v_now timestamptz := now();
  v_closed_count integer := 0;
  v_close_result jsonb;
begin
  for v_candidate in
    select rider_id, shop_id
    from public.rider_current_locations
    where outside_area_since is not null
      and outside_area_since <= (v_now - interval '15 minutes')
    order by rider_id
  loop
    perform pg_advisory_xact_lock_shared(
      hashtextextended('shop:' || v_candidate.shop_id::text, 0)
    );
    perform pg_advisory_xact_lock(hashtextextended(v_candidate.rider_id::text, 0));

    select l.rider_id, l.work_session_id, l.outside_area_since,
           l.lat, l.lng, s.service_area_enabled, s.rider_work_radius_m,
           s.shop_lat, s.shop_lng
    into v_location
    from public.rider_current_locations l
    join public.shops s on s.id = l.shop_id
    where l.rider_id = v_candidate.rider_id
      and l.shop_id = v_candidate.shop_id
    for update of l;

    if not found then
      continue;
    end if;

    if not v_location.service_area_enabled
       or public.calc_distance_meters(
         v_location.shop_lat,
         v_location.shop_lng,
         v_location.lat,
         v_location.lng
       ) <= v_location.rider_work_radius_m then
      update public.rider_current_locations
      set outside_area_since = null
      where rider_id = v_candidate.rider_id;
      continue;
    end if;

    if v_location.outside_area_since is not null
       and (v_now - v_location.outside_area_since) >= interval '15 minutes' then
      v_close_result := public.close_rider_work_session_internal(
        v_candidate.rider_id,
        v_location.work_session_id,
        v_now
      );
      if coalesce((v_close_result ->> 'closed')::boolean, false) then
        v_closed_count := v_closed_count + 1;
      end if;
    end if;
  end loop;

  return v_closed_count;
end;
$$;

revoke all on function public.sweep_expired_rider_geofence_sessions()
  from public, anon, authenticated;
grant execute on function public.sweep_expired_rider_geofence_sessions()
  to service_role;

comment on function public.sweep_expired_rider_geofence_sessions() is
  'Restricted service-role fallback: closes rider work sessions outside their configured work area for at least 15 minutes.';

-- ==================================================================================
-- update_shop_geo: DB-authoritative geo update with rider re-evaluation.
-- Shared by both coordinate changes and radius changes.
-- Uses the same rider advisory lock as report_rider_location and sweep.
-- ==================================================================================
create or replace function public.update_shop_geo(
  p_shop_id uuid,
  p_shop_lat double precision,
  p_shop_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_shop public.shops%rowtype;
  v_rider record;
  v_location record;
  v_dist double precision;
  v_now timestamptz := now();
begin
  -- 1. Auth check
  if auth.uid() is null or not public.has_shop_access(p_shop_id) then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  -- 2. Validate coordinate pair (both or neither)
  if (p_shop_lat is not null and p_shop_lng is null)
     or (p_shop_lat is null and p_shop_lng is not null) then
    raise exception 'INVALID_COORDINATES: ต้องระบุทั้ง latitude และ longitude';
  end if;

  if p_shop_lat is not null then
    if p_shop_lat < -90 or p_shop_lat > 90 then
      raise exception 'INVALID_COORDINATES: latitude ต้องอยู่ระหว่าง -90 ถึง 90';
    end if;
    if p_shop_lng < -180 or p_shop_lng > 180 then
      raise exception 'INVALID_COORDINATES: longitude ต้องอยู่ระหว่าง -180 ถึง 180';
    end if;
  end if;

  -- Block concurrent rider reports/starts while the boundary center and all
  -- current rider timers are updated as one transaction.
  perform pg_advisory_xact_lock(hashtextextended('shop:' || p_shop_id::text, 0));

  -- 3. Lock shop row
  select * into v_shop
  from public.shops
  where id = p_shop_id
  for update;

  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  -- The shops constraint requires coordinates while enforcement is enabled.
  -- Fail with a stable domain error before attempting distance calculations or
  -- relying on the generic constraint violation from the subsequent update.
  if v_shop.service_area_enabled and p_shop_lat is null then
    raise exception 'SHOP_COORDINATES_REQUIRED';
  end if;

  -- 4. Skip if nothing changed
  if v_shop.shop_lat is not distinct from p_shop_lat
     and v_shop.shop_lng is not distinct from p_shop_lng then
    return jsonb_build_object('changed', false);
  end if;

  -- 5. Update coordinates
  update public.shops
  set shop_lat = p_shop_lat,
      shop_lng = p_shop_lng,
      updated_at = v_now
  where id = p_shop_id;

  -- 6. Re-evaluate every current rider in deterministic lock order. This also
  -- serializes the disabled-enforcement clear path instead of bulk-updating.
  for v_rider in
    select rider_id
    from public.rider_current_locations
    where shop_id = p_shop_id
    order by rider_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_rider.rider_id::text, 0));

    select rider_id, lat, lng, outside_area_since
    into v_location
    from public.rider_current_locations
    where rider_id = v_rider.rider_id
      and shop_id = p_shop_id
    for update;

    if not found then
      continue;
    end if;

    if not v_shop.service_area_enabled then
      update public.rider_current_locations
      set outside_area_since = null
      where rider_id = v_location.rider_id
        and outside_area_since is not null;
      continue;
    end if;

    v_dist := public.calc_distance_meters(
      p_shop_lat,
      p_shop_lng,
      v_location.lat,
      v_location.lng
    );

    if v_dist <= v_shop.rider_work_radius_m then
      update public.rider_current_locations
      set outside_area_since = null
      where rider_id = v_location.rider_id
        and outside_area_since is not null;
    else
      update public.rider_current_locations
      set outside_area_since = coalesce(v_location.outside_area_since, v_now)
      where rider_id = v_location.rider_id;
    end if;
  end loop;

  return jsonb_build_object(
    'changed', true,
    'shop_lat', p_shop_lat,
    'shop_lng', p_shop_lng
  );
end;
$$;

revoke all on function public.update_shop_geo(uuid, double precision, double precision)
  from public, anon;
grant execute on function public.update_shop_geo(uuid, double precision, double precision)
  to authenticated;
