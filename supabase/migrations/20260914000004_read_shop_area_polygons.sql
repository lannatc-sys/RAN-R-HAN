-- ==============================================================================
-- RAN-R-HAN: อ่านรูปหลายเหลี่ยมพื้นที่ให้บริการกลับมาเป็น GeoJSON
--
-- คอลัมน์เก็บเป็น geography ซึ่ง PostgREST ส่งกลับมาเป็น WKB hex ใช้ต่อไม่ได้
-- ในเบราว์เซอร์ ฟังก์ชันนี้แปลงเป็น GeoJSON ให้ตรงกับรูปที่ฝั่งหน้าเว็บใช้อยู่
-- เพื่อให้เปิดหน้ามาแล้วเห็นพื้นที่ที่เคยวาดไว้ แทนที่จะเริ่มจากศูนย์ทุกครั้ง
--
-- เป็น security definer เพราะอ่านข้ามร้าน ผู้เรียกต้องเป็น superadmin
-- ==============================================================================

create or replace function public.get_shop_area_polygons(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_shop public.shops%rowtype;
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'customer',
    case
      when v_shop.service_area_polygon is null then null
      else extensions.st_asgeojson(v_shop.service_area_polygon)::jsonb
    end,
    'rider',
    case
      when v_shop.rider_work_area_polygon is null then null
      else extensions.st_asgeojson(v_shop.rider_work_area_polygon)::jsonb
    end
  );
end;
$$;

revoke all on function public.get_shop_area_polygons(uuid) from public, anon;
grant execute on function public.get_shop_area_polygons(uuid) to authenticated;
