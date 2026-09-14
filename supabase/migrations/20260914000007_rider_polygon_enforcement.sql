-- ==============================================================================
-- RAN-R-HAN: บังคับใช้ rider_work_area_polygon ในทุกเส้นทาง geofence ของไรเดอร์
--
-- ฟังก์ชันเป้าหมายมี advisory lock, row lock และลูปเรียงตาม rider_id ที่ห้ามหาย
-- migration นี้จึงอ่าน definition ที่ติดตั้งอยู่จริง แล้ว replace เฉพาะนิพจน์
-- ตัดสินพื้นที่เท่านั้น ไม่คัดลอก function body มาเขียนใหม่
--
-- แต่ละ pattern ต้องพบหนึ่งครั้งพอดี ถ้า schema ต้นทางไม่ตรงกับที่ตรวจไว้
-- ให้หยุดทั้ง migration แทนการเดาหรือ apply เพียงบางฟังก์ชัน
-- ==============================================================================

begin;

do $migration$
declare
  v_signatures text[] := array[
    'public.start_rider_work_session(uuid,double precision,double precision,jsonb)',
    'public.report_rider_location(uuid,double precision,double precision,numeric,numeric,numeric)',
    'public.sweep_expired_rider_geofence_sessions()',
    'public.sweep_expired_rider_geofence_sessions()',
    'public.set_shop_service_area_settings(uuid,boolean,numeric,numeric)',
    'public.update_shop_geo(uuid,double precision,double precision)'
  ];
  v_labels text[] := array[
    'start_rider_work_session area check',
    'report_rider_location area check',
    'sweep_expired_rider_geofence_sessions shop select',
    'sweep_expired_rider_geofence_sessions area check',
    'set_shop_service_area_settings area check',
    'update_shop_geo area check'
  ];
  v_patterns text[] := array[
    $old$    v_dist := public.calc_distance_meters(v_shop.shop_lat, v_shop.shop_lng, p_lat, p_lng);
    if v_dist > v_shop.rider_work_radius_m then$old$,
    $old$    v_dist := public.calc_distance_meters(v_shop.shop_lat, v_shop.shop_lng, p_lat, p_lng);
    if v_dist <= v_shop.rider_work_radius_m then$old$,
    $old$    select l.rider_id, l.work_session_id, l.outside_area_since,
           l.lat, l.lng, s.service_area_enabled, s.rider_work_radius_m,
           s.shop_lat, s.shop_lng$old$,
    $old$    if not v_location.service_area_enabled
       or public.calc_distance_meters(
         v_location.shop_lat,
         v_location.shop_lng,
         v_location.lat,
         v_location.lng
       ) <= v_location.rider_work_radius_m then$old$,
    $old$      v_dist := public.calc_distance_meters(
        v_shop.shop_lat,
        v_shop.shop_lng,
        v_location.lat,
        v_location.lng
      );

      if v_dist <= p_rider_work_radius_m then$old$,
    $old$    v_dist := public.calc_distance_meters(
      p_shop_lat,
      p_shop_lng,
      v_location.lat,
      v_location.lng
    );

    if v_dist <= v_shop.rider_work_radius_m then$old$
  ];
  v_replacements text[] := array[
    $new$    if not public.is_point_in_shop_area(
      v_shop.rider_work_area_polygon,
      v_shop.shop_lat,
      v_shop.shop_lng,
      v_shop.rider_work_radius_m,
      p_lat,
      p_lng
    ) then$new$,
    $new$    if public.is_point_in_shop_area(
      v_shop.rider_work_area_polygon,
      v_shop.shop_lat,
      v_shop.shop_lng,
      v_shop.rider_work_radius_m,
      p_lat,
      p_lng
    ) then$new$,
    $new$    select l.rider_id, l.work_session_id, l.outside_area_since,
           l.lat, l.lng, s.service_area_enabled, s.rider_work_radius_m,
           s.rider_work_area_polygon, s.shop_lat, s.shop_lng$new$,
    $new$    if not v_location.service_area_enabled
       or public.is_point_in_shop_area(
         v_location.rider_work_area_polygon,
         v_location.shop_lat,
         v_location.shop_lng,
         v_location.rider_work_radius_m,
         v_location.lat,
         v_location.lng
       ) then$new$,
    $new$      if public.is_point_in_shop_area(
        v_shop.rider_work_area_polygon,
        v_shop.shop_lat,
        v_shop.shop_lng,
        p_rider_work_radius_m,
        v_location.lat,
        v_location.lng
      ) then$new$,
    $new$    if public.is_point_in_shop_area(
      v_shop.rider_work_area_polygon,
      p_shop_lat,
      p_shop_lng,
      v_shop.rider_work_radius_m,
      v_location.lat,
      v_location.lng
    ) then$new$
  ];
  v_index integer;
  v_oid regprocedure;
  v_definition text;
  v_pattern text;
  v_replacement text;
  v_occurrences integer;
begin
  for v_index in 1..array_length(v_signatures, 1)
  loop
    v_oid := to_regprocedure(v_signatures[v_index]);
    if v_oid is null then
      raise exception 'MIGRATION_TARGET_MISSING: %', v_signatures[v_index];
    end if;

    v_definition := replace(pg_get_functiondef(v_oid), chr(13), '');
    v_pattern := replace(v_patterns[v_index], chr(13), '');
    v_replacement := replace(v_replacements[v_index], chr(13), '');

    v_occurrences := (
      length(v_definition) - length(replace(v_definition, v_pattern, ''))
    ) / length(v_pattern);

    if v_occurrences <> 1 then
      raise exception 'MIGRATION_PATTERN_COUNT_MISMATCH: % expected 1 occurrence, found %',
        v_labels[v_index], v_occurrences;
    end if;

    v_definition := replace(v_definition, v_pattern, v_replacement);
    execute v_definition;
  end loop;
end;
$migration$;

commit;
