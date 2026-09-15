-- ==============================================================================
-- RAN-R-HAN: ค่าส่งคงที่ต่อร้าน และ snapshot ลงออเดอร์ตอนสร้าง
--
-- ปัญหาเดิม: คอลัมน์ `orders.delivery_fee` มีมาตั้งแต่ 20260911000001 และมีคนอ่าน
-- อยู่สามที่ (ใบงานไรเดอร์, งานที่รับแล้ว, ยอดค่ารอบในหน้า settlement)
-- แต่ **ไม่มีโค้ดไหนเขียนค่าลงไปเลย** ค่าจึงเป็น 0 เสมอ
-- และร้านก็ไม่มีที่ให้ตั้งค่าส่ง เพราะ `shops` ไม่มีคอลัมน์นั้น
--
-- รอบนี้ทำแบบคงที่ต่อร้านตามที่ตกลงไว้ ยังไม่คิดตามระยะ เพราะการคิดตามระยะ
-- ต้องตกลง business rule อีกชุด (ระยะฟรี, ราคาต่อ กม., การปัดเศษ, ขั้นต่ำ/สูงสุด)
-- ซึ่งยังไม่ได้ตกลงกัน
--
-- **snapshot ไม่ใช่ join** ตอนสร้างออเดอร์จะคัดค่า `shops.delivery_base_fee`
-- ลง `orders.delivery_fee` ทันที ออเดอร์เก่าจึงไม่เปลี่ยนยอดตามการตั้งค่าใหม่
-- ของร้านในภายหลัง ซึ่งสำคัญกับการคิดค่ารอบย้อนหลัง
--
-- หมายเหตุ: migration นี้ **ยังไม่ถูกลงทะเบียนใน scripts/run-db.js**
-- เพราะไฟล์นั้นอีก lane ถืออยู่ ต้องลงทะเบียนเป็นขั้นถัดจากของ lane นั้น
-- ก่อนถือว่างานนี้จบ ไม่งั้นฐานข้อมูลที่สร้างใหม่จะไม่มีคอลัมน์นี้
-- ==============================================================================

-- 1. ให้ร้านตั้งค่าส่งของตัวเองได้ ---------------------------------------------
alter table public.shops
  add column if not exists delivery_base_fee numeric(10, 2) not null default 0;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_delivery_base_fee_range'
  ) then
    -- กันค่าติดลบและค่าที่พิมพ์ผิดจนเกินจริง เพดานกว้างพอสำหรับร้านนอกเมือง
    alter table public.shops
      add constraint shops_delivery_base_fee_range
      check (delivery_base_fee >= 0 and delivery_base_fee <= 1000);
  end if;
end;
$constraint$;

comment on column public.shops.delivery_base_fee is
  'ค่าส่งคงที่ต่อออเดอร์ของร้านนี้ ถูก snapshot ลง orders.delivery_fee ตอนสร้างออเดอร์';

-- 2. ให้ create_pickup_order คิดค่าส่งและบันทึกลงออเดอร์ ------------------------
--
-- ฟังก์ชันนี้มีการล็อกแถวเมนูระหว่างคิดราคาอยู่ข้างใน การคัดลอก body มาเขียนใหม่
-- จากที่เห็นบางส่วนเคยทำให้ของแบบนั้นหายมาแล้วในโปรเจกต์นี้ จึงอ่านนิยามจริงจาก
-- ฐานข้อมูลแล้วแทนที่เฉพาะข้อความเป้าหมาย และบังคับว่าต้องเจอพอดีหนึ่งครั้ง
do $migrate$
declare
  v_oid oid;
  v_count int;
  v_src text;
  v_out text;
  v_pattern text;
  v_replacement text;
  v_i int;
  v_patterns text[];
  v_replacements text[];
begin
  select count(*), min(p.oid) into v_count, v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_pickup_order';

  if v_count <> 1 then
    raise exception 'MIGRATION_TARGET_AMBIGUOUS: create_pickup_order มี % ตัว คาดว่าต้องมี 1', v_count;
  end if;

  v_src := replace(pg_get_functiondef(v_oid), chr(13), '');

  v_patterns := array[
    -- ตัวแปรเก็บค่าส่งของออเดอร์นี้
    E'    v_total numeric(10, 2) := 0.00;\n',

    -- คิดยอดรวม ค่าส่งบวกหลัง VAT เพราะ VAT คิดจากค่าอาหารและค่าบริการเท่านั้น
    E'    if v_shop.vat_mode = \'exclusive\' then\n        v_vat := round((v_subtotal + v_service_charge) * 0.07, 2);\n        v_total := v_subtotal + v_service_charge + v_vat;\n    elsif v_shop.vat_mode = \'inclusive\' then\n        v_vat := round((v_subtotal + v_service_charge) * 7.0 / 107.0, 2);\n        v_total := v_subtotal + v_service_charge;\n    else\n        v_vat := 0.00;\n        v_total := v_subtotal + v_service_charge;\n    end if;\n',

    -- เขียนค่าส่งลงออเดอร์พร้อมยอดอื่น
    E'    set subtotal = v_subtotal,\n        service_charge_amount = v_service_charge,\n        vat_amount = v_vat,\n        total = v_total\n',

    -- คืนค่าให้ผู้เรียกเห็นด้วย
    E'        \'vat\', v_vat,\n        \'total\', v_total\n'
  ];

  v_replacements := array[
    E'    v_total numeric(10, 2) := 0.00;\n    v_delivery_fee numeric(10, 2) := 0.00;\n',

    E'    if v_order_type = \'delivery\'::public.order_type then\n        v_delivery_fee := coalesce(v_shop.delivery_base_fee, 0.00);\n    end if;\n\n    if v_shop.vat_mode = \'exclusive\' then\n        v_vat := round((v_subtotal + v_service_charge) * 0.07, 2);\n        v_total := v_subtotal + v_service_charge + v_vat + v_delivery_fee;\n    elsif v_shop.vat_mode = \'inclusive\' then\n        v_vat := round((v_subtotal + v_service_charge) * 7.0 / 107.0, 2);\n        v_total := v_subtotal + v_service_charge + v_delivery_fee;\n    else\n        v_vat := 0.00;\n        v_total := v_subtotal + v_service_charge + v_delivery_fee;\n    end if;\n',

    E'    set subtotal = v_subtotal,\n        service_charge_amount = v_service_charge,\n        vat_amount = v_vat,\n        delivery_fee = v_delivery_fee,\n        total = v_total\n',

    E'        \'vat\', v_vat,\n        \'delivery_fee\', v_delivery_fee,\n        \'total\', v_total\n'
  ];

  v_out := v_src;
  for v_i in 1 .. array_length(v_patterns, 1) loop
    v_pattern := replace(v_patterns[v_i], chr(13), '');
    v_replacement := replace(v_replacements[v_i], chr(13), '');

    if (length(v_out) - length(replace(v_out, v_pattern, ''))) / length(v_pattern) <> 1 then
      raise exception 'MIGRATION_PATTERN_COUNT_MISMATCH: ข้อความที่ % ต้องเจอพอดี 1 ครั้ง', v_i;
    end if;

    v_out := replace(v_out, v_pattern, v_replacement);
  end loop;

  if v_out = v_src then
    raise exception 'MIGRATION_NO_CHANGE: create_pickup_order ไม่ถูกแก้';
  end if;

  execute v_out;
end;
$migrate$;

-- สิทธิ์เดิมของฟังก์ชันถูกคงไว้โดย pg_get_functiondef อยู่แล้ว
-- ตั้งซ้ำให้ชัดเจนเผื่อกรณีที่นิยามเดิมไม่ได้ระบุไว้
revoke execute on function public.create_pickup_order from public;
grant execute on function public.create_pickup_order to anon, authenticated;
