-- Migration: 20260912000001_dispatch_timeout_atomic.sql
-- วัตถุประสงค์: สร้าง RPC expire_dispatch_offers() เพื่อจัดการ expiration ของ dispatch offers
--              ใน transaction เดียว พร้อม advisory lock ป้องกัน concurrent run
--              และคืน summary สำหรับ logging

-- ใช้ timestamp วันถัดไป (2026-09-12) เพื่อให้ Supabase เรียงลำดับรันถูกต้อง
-- ซึ่งแตกต่างจาก migration ล่าสุดคือ 20260911000006_rider_concurrency_lock.sql

-- ============================================================================
-- ฟังก์ชัน: expire_dispatch_offers()
-- เวลาเรียกใช้: จาก /api/cron/dispatch-timeout ทุก 1 นาที
-- ล็อก: pg_advisory_xact_lock เพื่อป้องกัน overlapping execution
-- ============================================================================

create or replace function public.expire_dispatch_offers()
returns table (
  expired_count     bigint,
  redispatched_count bigint,
  error_count       bigint,
  run_at            timestamptz
)
language plpgsql
security definer  -- ต้องใช้ admin permission เพื่ออัปเดต dispatch_offers/orders
as $$
declare
  v_now            timestamptz := now();
  v_lock_key       integer    := hashtext('dispatch_timeout_cron'::text);
  v_offers         cursor    for
    select id, order_id, dispatch_round
    from public.dispatch_offers
    where status = 'offered'
      and timeout_at < v_now
    for update;  -- ล็อกแถวเพื่อป้องกัน concurrent update
begin
  -- advisory lock ป้องกัน concurrent cron runs
  -- ถ้ามี session อื่นถือ lock อยู่ จะรอจน lock เสร็จ
  -- แต่ถ้า lock ไม่สำเร็จภายใน timeout (เช่น session อื่นถือไว้นาน) จะ skip
  if not pg_try_advisory_xact_lock(v_lock_key) then
    -- มี cron อื่นกำลังรันอยู่ — ไม่ต้องทำซ้ำ (idempotent)
    return query
      select 0::bigint, 0::bigint, 0::bigint, v_now;
    return;
  end if;

  -- จัดการแต่ละ offer ที่หมดเวลา
  -- ใช้ loop เพราะต้องตรวจสอบ dispatch_round และอัปเดต order แยกกัน
  -- แต่ยังอยู่ใน transaction เดียวกัน ทำให้ atomic
  declare
    v_expired         bigint    := 0;
    v_redispatched    bigint    := 0;
    v_errors          bigint    := 0;
    v_offer_id        uuid;
    v_order_id        uuid;
    v_dispatch_round  integer;
    v_orders_affected integer;
  begin
    open v_offers;

    loop
      fetch v_offers into v_offer_id, v_order_id, v_dispatch_round;
      exit when not found;

      begin
        -- 1. อัปเดต dispatch_offers เป็น timed_out (เฉพาะถ้ายังเป็น offered อยู่)
        update public.dispatch_offers
        set status         = 'timed_out',
            responded_at  = v_now
        where id = v_offer_id
          and status = 'offered';

        if found then
          v_expired := v_expired + 1;

          -- 2. ถ้ายังไม่ครบ MAX_DISPATCH_ROUNDS ให้ reset order กลับเป็น pending
          --    ( ready สำหรับ dispatch รอบถัดไป )
          if v_dispatch_round < 3 then  -- MAX_DISPATCH_ROUNDS = 3
            update public.orders
            set dispatch_status = 'pending'
            where id = v_order_id
              and dispatch_status = 'dispatching';

            if found then
              v_redispatched := v_redispatched + 1;
            end if;
          end if;
        end if;
      exception
        when others then
          v_errors := v_errors + 1;
          -- log error แต่ไม่ raise — ให้ cron ทำงานต่อ
          RAISE WARNING 'expire_dispatch_offers: error processing offer %: %',
            v_offer_id, sqlerrm;
      end;
    end loop;

    close v_offers;

    return query
      select v_expired::bigint, v_redispatched::bigint, v_errors::bigint, v_now;
  end;
end;
$$;

comment on function public.expire_dispatch_offers() is
  'Expire dispatch offers that have timed out, reset orders for redispatch. Called by /api/cron/dispatch-timeout every 1 minute. Uses advisory lock for concurrency safety.';
