-- ==============================================================================
-- RAN-R-HAN: Operator-drawn service-area polygons
--
-- เพิ่มขอบเขตแบบรูปหลายเหลี่ยมที่วาดบนแผนที่ได้ โดยไม่รื้อระบบรัศมีเดิม
-- ถ้าร้านวาด polygon ไว้ ระบบจะใช้ polygon ถ้าไม่ได้วาด จะใช้รัศมีเดิมเป็น fallback
--
-- migration 20260912000006 ผ่านการรันจริงบน PostgreSQL มาแล้ว จึงไม่แก้ไฟล์นั้น
-- แต่ใช้ create or replace ทับฟังก์ชันที่ต้องเปลี่ยนจากไฟล์นี้แทน
-- ==============================================================================

alter table public.shops
  add column if not exists service_area_polygon extensions.geography(Polygon, 4326),
  add column if not exists rider_work_area_polygon extensions.geography(Polygon, 4326);

-- ------------------------------------------------------------------------------
-- ตัวตัดสินกลางเพียงจุดเดียวว่า "พิกัดนี้อยู่ในเขตหรือไม่"
--
-- ทุกเส้นทางบังคับใช้ต้องเรียกฟังก์ชันนี้ ห้ามเขียนตรรกะซ้ำที่อื่น
-- ถ้าแก้ไม่ครบทุกจุดจะเกิดช่องโหว่ที่บางเส้นทางยังใช้วงกลมอยู่
--
-- ไม่ประกาศเป็น STRICT โดยตั้งใจ เพราะ p_polygon เป็น null ได้ในกรณีใช้รัศมี
-- ถ้าเป็น STRICT จะคืน null ทั้งหมดแล้วกลายเป็น fail-open
-- ------------------------------------------------------------------------------
create or replace function public.is_point_in_shop_area(
  p_polygon extensions.geography,
  p_center_lat double precision,
  p_center_lng double precision,
  p_radius_m numeric,
  p_lat double precision,
  p_lng double precision
)
returns boolean
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select case
    -- fail closed: ไม่มีพิกัด = ไม่อยู่ในเขตเสมอ
    when p_lat is null or p_lng is null then false
    when p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then false
    -- polygon ชนะรัศมีเมื่อร้านวาดไว้
    when p_polygon is not null then extensions.st_covers(
      p_polygon,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    )
    -- fallback รัศมีเดิม fail closed เมื่อพิกัดร้านหรือรัศมีหาย
    when p_center_lat is null or p_center_lng is null or p_radius_m is null then false
    else public.calc_distance_meters(p_center_lat, p_center_lng, p_lat, p_lng) <= p_radius_m
  end;
$$;

revoke all on function public.is_point_in_shop_area(
  extensions.geography, double precision, double precision, numeric, double precision, double precision
) from public, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- แปลง GeoJSON จากหน้าเว็บเป็น geography พร้อมตรวจความถูกต้อง
-- คืน null เมื่อไม่ได้ส่ง polygon มา (แปลว่าให้ใช้รัศมี)
-- ------------------------------------------------------------------------------
create or replace function public.parse_area_polygon(p_geojson jsonb)
returns extensions.geography
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_geom extensions.geometry;
  v_geog extensions.geography;
begin
  if p_geojson is null or jsonb_typeof(p_geojson) = 'null' then
    return null;
  end if;

  begin
    v_geom := extensions.st_geomfromgeojson(p_geojson::text);
  exception when others then
    raise exception 'INVALID_SERVICE_AREA_POLYGON';
  end;

  if v_geom is null or extensions.st_geometrytype(v_geom) <> 'ST_Polygon' then
    raise exception 'INVALID_SERVICE_AREA_POLYGON';
  end if;

  if not extensions.st_isvalid(v_geom) then
    raise exception 'INVALID_SERVICE_AREA_POLYGON';
  end if;

  -- วงแหวนต้องมีอย่างน้อย 3 จุดที่ไม่ซ้ำกัน (4 จุดรวมจุดปิด)
  if extensions.st_npoints(v_geom) < 4 then
    raise exception 'INVALID_SERVICE_AREA_POLYGON';
  end if;

  v_geog := extensions.st_setsrid(v_geom, 4326)::extensions.geography;

  -- จำกัดพื้นที่ไม่เกินเพดานเดียวกับรัศมี 200 กม. กันวาดคลุมทั้งโลก
  if extensions.st_area(v_geog) > 1.26e11 then
    raise exception 'SERVICE_AREA_POLYGON_TOO_LARGE';
  end if;

  return v_geog;
end;
$$;

revoke all on function public.parse_area_polygon(jsonb)
  from public, anon, authenticated, service_role;
