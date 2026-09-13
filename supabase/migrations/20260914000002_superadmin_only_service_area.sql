-- ==============================================================================
-- RAN-R-HAN: ย้ายการกำหนดพื้นที่ให้บริการมาอยู่กับ superadmin เท่านั้น
--
-- เดิมเจ้าของร้านตั้งพิกัดร้านและรัศมีเองได้ เพราะทั้งสอง RPC ตรวจด้วย
-- has_shop_access ซึ่งคืน true ให้ทั้ง superadmin และคนของร้านนั้น
--
-- การลบหน้าเว็บออกอย่างเดียวไม่พอ เพราะ RPC ยังเรียกตรงได้ด้วย token ของร้าน
-- ด่านจึงต้องย้ายมาไว้ที่ตัวฟังก์ชัน
--
-- สองฟังก์ชันนี้มีตรรกะ concurrency ที่เปราะ (advisory lock, select for update,
-- ลูปเรียงตาม rider_id กันเดดล็อก) การคัดลอก body มาวางใหม่เคยทำให้ตรรกะหาย
-- ไฟล์นี้จึงอ่านซอร์สที่ติดตั้งอยู่จริงแล้วแทนที่เฉพาะบรรทัดตรวจสิทธิ์
-- ถ้าหาบรรทัดนั้นไม่เจอจะ raise ทันที ไม่ปล่อยผ่านเงียบ ๆ
-- ==============================================================================

do $$
declare
  v_target text;
  v_def text;
  v_new text;
begin
  foreach v_target in array array['update_shop_geo', 'set_shop_service_area_settings']
  loop
    select pg_get_functiondef(p.oid)
      into v_def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = v_target;

    if v_def is null then
      raise exception 'MIGRATION_TARGET_MISSING: public.%', v_target;
    end if;

    if position('public.has_shop_access(p_shop_id)' in v_def) = 0 then
      -- อาจถูกแก้ไปแล้วในรอบก่อน หรือซอร์สเปลี่ยนรูป ต้องให้คนตรวจ
      if position('public.is_superadmin()' in v_def) > 0 then
        raise notice 'public.% ถูกจำกัดเป็น superadmin อยู่แล้ว ข้าม', v_target;
        continue;
      end if;
      raise exception 'MIGRATION_PATTERN_NOT_FOUND: public.% ไม่มีบรรทัด has_shop_access ที่คาดไว้', v_target;
    end if;

    v_new := replace(
      v_def,
      'public.has_shop_access(p_shop_id)',
      'public.is_superadmin()'
    );

    execute v_new;
  end loop;
end;
$$;

-- ------------------------------------------------------------------------------
-- บันทึกรูปหลายเหลี่ยมที่วาดบนแผนที่
--
-- parse_area_polygon ถูก revoke จากทุก role ไว้ จึงเรียกได้เฉพาะจากใน
-- security definer แบบนี้เท่านั้น ส่ง p_geojson เป็น null เพื่อลบ polygon
-- แล้วให้ร้านกลับไปใช้รัศมีเดิม
-- ------------------------------------------------------------------------------
create or replace function public.set_shop_service_area_polygon(
  p_shop_id uuid,
  p_kind text,
  p_geojson jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_geog extensions.geography;
  v_found uuid;
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  if p_kind is null or p_kind not in ('customer', 'rider') then
    raise exception 'INVALID_SERVICE_AREA_KIND';
  end if;

  -- ตรวจรูปทรงก่อนแตะตาราง ถ้า geojson ใช้ไม่ได้จะ raise จากในนี้
  v_geog := public.parse_area_polygon(p_geojson);

  if p_kind = 'customer' then
    update public.shops
       set service_area_polygon = v_geog,
           updated_at = now()
     where id = p_shop_id
    returning id into v_found;
  else
    update public.shops
       set rider_work_area_polygon = v_geog,
           updated_at = now()
     where id = p_shop_id
    returning id into v_found;
  end if;

  if v_found is null then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'shop_id', p_shop_id,
    'kind', p_kind,
    'cleared', v_geog is null
  );
end;
$$;

revoke all on function public.set_shop_service_area_polygon(uuid, text, jsonb)
  from public, anon;
grant execute on function public.set_shop_service_area_polygon(uuid, text, jsonb)
  to authenticated;
