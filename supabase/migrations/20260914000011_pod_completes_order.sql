-- ==============================================================================
-- RAN-R-HAN: ส่งของเสร็จแล้วปิดออเดอร์ให้ครบวงจร
--
-- ที่มา (State Consumer Audit 2026-09-14):
-- `orders.status` เป็น overall order lifecycle ไม่ใช่สถานะของครัวอย่างเดียว
--   - `src/lib/orders.ts` ประกาศ state machine ทั้งตัวไว้ served -> completed
--   - `confirmed` ถูกเขียนโดย RPC ตอนยืนยันการชำระเงิน ไม่ใช่โดยครัว
--   - หน้าลูกค้า ยอดขาย guard การชำระเงิน และ Telegram อ่านค่านี้
--
-- แต่เส้นทางไรเดอร์เปลี่ยนแค่ `dispatch_status` ลูกค้าและ KDS จึงยังเห็นว่า
-- ออเดอร์ค้างอยู่ที่ "เสิร์ฟแล้ว" ทั้งที่ของถึงมือลูกค้าไปแล้ว
--
-- Settlement และยอดไรเดอร์อ่าน `dispatch_status='delivered'` ไม่ได้อ่านค่านี้
-- การเปลี่ยนตรงนี้จึงไม่กระทบเรื่องเงิน
--
-- ==============================================================================
-- invariant ที่บังคับเพิ่ม
--
-- ก่อนหน้านี้ `finalize_rider_delivery_event` ไม่เคยอ่าน `orders.status` เลย
-- ถ้าเขียนแบบ `update ... where status = 'served'` เฉย ๆ แล้วไม่มีแถวถูกแก้
-- จะได้สถานะที่ขัดกันเอง คือ `dispatch_status='delivered'` แต่ `status` ยังค้าง
-- โดยไม่มีใครรู้ จึงเลือก raise แล้วให้ทั้งธุรกรรมย้อนกลับแทน
--
-- ผลคือการปิดงานส่งจะสำเร็จเฉพาะออเดอร์ที่ครัวกดเสิร์ฟแล้วเท่านั้น
-- ถ้ายังเป็น cooking/confirmed จะถูกปฏิเสธด้วย ORDER_NOT_SERVED
-- และไม่มีอะไรถูกเขียนเลย ทั้ง delivery_events, การผูก POD และ dispatch_status
-- ==============================================================================

do $migrate$
declare
  v_oid oid;
  v_count int;
  v_src text;
  v_out text;
  v_i int;
  v_pattern text;
  v_replacement text;
  v_patterns text[];
  v_replacements text[];
begin
  select count(*), min(p.oid) into v_count, v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'finalize_rider_delivery_event';

  if v_count <> 1 then
    raise exception 'MIGRATION_TARGET_AMBIGUOUS: finalize_rider_delivery_event มี % ตัว', v_count;
  end if;

  v_src := replace(pg_get_functiondef(v_oid), chr(13), '');

  v_patterns := array[
    -- ตัวแปรเก็บสถานะออเดอร์ที่อ่านมาพร้อมกับตอนล็อกแถว
    E'  v_transition_valid boolean := false;\n',

    -- อ่าน status มาด้วยตอนที่ล็อกแถวอยู่แล้ว ไม่ต้อง query เพิ่ม
    E'  select o.assigned_rider_id, o.shop_id\n  into v_rider_id, v_shop_id\n  from public.orders o\n  where o.id = p_order_id\n  for update;\n',

    -- ปิดงานส่งแล้วปิดออเดอร์ในธุรกรรมเดียวกัน
    E'  elsif v_event_type in (\'delivered\', \'unreachable_drop\') then\n    update public.orders set dispatch_status = \'delivered\' where id = p_order_id;\n  end if;\n'
  ];

  v_replacements := array[
    E'  v_transition_valid boolean := false;\n  v_order_status text;\n',

    E'  select o.assigned_rider_id, o.shop_id, o.status::text\n  into v_rider_id, v_shop_id, v_order_status\n  from public.orders o\n  where o.id = p_order_id\n  for update;\n',

    E'  elsif v_event_type in (\'delivered\', \'unreachable_drop\') then\n    -- ปิดงานส่งได้เฉพาะออเดอร์ที่ครัวกดเสิร์ฟแล้ว ไม่ปล่อยให้สองสถานะขัดกันเอง\n    -- ยอมรับ completed ด้วยเพื่อให้ยิงซ้ำไม่ระเบิดโดยไม่จำเป็น\n    if v_order_status is null or v_order_status not in (\'served\', \'completed\') then\n      raise exception \'ORDER_NOT_SERVED\';\n    end if;\n\n    update public.orders\n       set dispatch_status = \'delivered\',\n           status = \'completed\',\n           updated_at = now()\n     where id = p_order_id;\n  end if;\n'
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
    raise exception 'MIGRATION_NO_CHANGE: finalize_rider_delivery_event ไม่ถูกแก้';
  end if;

  execute v_out;
end;
$migrate$;

-- สิทธิ์เดิมถูกคงไว้โดย pg_get_functiondef อยู่แล้ว ตั้งซ้ำให้ชัดเจน
revoke all on function public.finalize_rider_delivery_event(
  uuid, text, double precision, double precision, text, uuid
) from public, anon;
grant execute on function public.finalize_rider_delivery_event(
  uuid, text, double precision, double precision, text, uuid
) to authenticated, service_role;
