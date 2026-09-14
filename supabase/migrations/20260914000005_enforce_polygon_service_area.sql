-- ------------------------------------------------------------------------------
-- ให้ polygon มีผลจริงตอนรับออเดอร์ (C4)
--
-- ก่อนหน้านี้ enforce_service_area_for_new_orders วัดระยะจากจุดร้านอย่างเดียว
-- ร้านที่วาด polygon ไว้ผ่าน /superadmin/service-area-map จึงยังถูกตัดสินด้วยรัศมี
-- ไฟล์นี้เปลี่ยนให้เรียก is_point_in_shop_area
-- polygon ชนะเมื่อร้านวาดไว้ ไม่วาดก็ตกกลับไปใช้รัศมีเดิม
--
-- ขอบเขตที่ไฟล์นี้ครอบ: **เฉพาะการรับออเดอร์ของลูกค้าเท่านั้น**
-- เส้นทางไรเดอร์และการตั้งค่ายังเรียก calc_distance_meters ตรง ๆ อยู่อีกห้าจุด
-- ใน 20260912000006 คือ start_rider_work_session, report_rider_location,
-- sweep_expired_rider_geofence_sessions, set_shop_service_area_settings
-- และ update_shop_geo
--
-- แปลว่า `shops.rider_work_area_polygon` **ยังไม่มีผลกับอะไรเลย** ต้องมี
-- migration รอบถัดไปกวาดทั้งห้าจุดนั้นให้มาใช้ predicate เดียวกัน
-- พร้อมรักษา advisory lock และลูปเรียงตาม rider_id ของเดิมไว้ครบ
--
-- พฤติกรรม fail-closed เดิมคงไว้ครบ พิกัดลูกค้าหาย/นอกช่วง, พิกัดร้านหาย
-- หรือรัศมีหาย ยังคงถูกปฏิเสธเหมือนเดิม เพราะ is_point_in_shop_area คืน false
-- ในทุกกรณีนั้น
--
-- **เปลี่ยนพฤติกรรมการรับออเดอร์บน production** ห้าม apply รวมกับ migration อื่น
-- ให้ apply เป็นรอบแยกและทดสอบเฉพาะเรื่องนี้
-- ------------------------------------------------------------------------------

create or replace function public.enforce_service_area_for_new_orders()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_shop public.shops%rowtype;
begin
  if new.type <> 'delivery' then
    return new;
  end if;

  select * into v_shop
  from public.shops
  where id = new.shop_id
  for share;

  if coalesce(v_shop.service_area_enabled, false) then
    -- ตัวตัดสินกลางตัวเดียวกับ rider start, GPS report, sweep และ shop geo
    -- fail closed ในตัวอยู่แล้วเมื่อพิกัดหรือรัศมีไม่ครบ
    if not public.is_point_in_shop_area(
      v_shop.service_area_polygon,
      v_shop.shop_lat,
      v_shop.shop_lng,
      v_shop.service_radius_m,
      new.delivery_lat,
      new.delivery_lng
    ) then
      raise exception 'OUTSIDE_SERVICE_AREA: อยู่นอกเขตบริการ กรุณารอแผนการขยายการให้บริการ';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_service_area_for_new_orders()
  from public, anon, authenticated, service_role;
