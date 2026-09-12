-- Migration: 20260912000001_dispatch_timeout_atomic.sql
-- วัตถุประสงค์: สร้าง RPC expire_dispatch_offers() เพื่อจัดการ expiration ของ dispatch offers
--              ใน transaction เดียว พร้อม advisory lock ป้องกัน concurrent run
--              และคืน summary สำหรับ logging
--
-- วันที่: 2026-09-12
-- อ้างอิง: docs/03-rider-system-architecture.md, New Job.txt §8-10

-- ============================================================================
-- ฟังก์ชัน: expire_dispatch_offers()
-- เวลาเรียกใช้: จาก /api/cron/dispatch-timeout ทุก 1 นาที
-- ล็อก: pg_advisory_xact_lock เพื่อป้องกัน overlapping execution
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_dispatch_offers()
RETURNS TABLE (
  expired_count     bigint,
  redispatched_count bigint,
  error_count       bigint,
  run_at            timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER  -- ต้องใช้ admin permission เพื่ออัปเดต dispatch_offers/orders
-- ใช้ SET clause ของ function แทนคำสั่ง SET ใน body — ค่านี้ถูก apply ตอนเข้าฟังก์ชัน
-- และ restore อัตโนมัติตอนออกเสมอ (แม้ transaction จะ commit) ป้องกัน search_path
-- รั่วไปยัง query อื่นบน connection เดียวกันเมื่อใช้ pooling แบบ transaction mode (Supavisor/PgBouncer)
SET search_path = public, extensions
AS $$
DECLARE
  v_now            timestamptz;
  v_lock_key       integer;
  v_expired        bigint;
  v_redispatched   bigint;
  v_errors         bigint;
  v_offer_id       uuid;
  v_order_id       uuid;
  v_dispatch_round integer;
  v_cursor         refcursor;
BEGIN
  v_now := now();
  v_lock_key := hashtext('dispatch_timeout_cron'::text);
  v_expired := 0;
  v_redispatched := 0;
  v_errors := 0;

  -- advisory lock ป้องกัน concurrent cron runs
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, v_now;
    RETURN;
  END IF;

  -- เปิด cursor สำหรับดึง offers ที่หมดเวลา
  OPEN v_cursor FOR
    SELECT id, order_id, dispatch_round
    FROM public.dispatch_offers
    WHERE status = 'offered'
      AND timeout_at < v_now
    FOR UPDATE;

  LOOP
    FETCH v_cursor INTO v_offer_id, v_order_id, v_dispatch_round;
    EXIT WHEN NOT FOUND;

    BEGIN
      -- อัปเดต dispatch_offers เป็น timed_out
      UPDATE public.dispatch_offers
      SET status = 'timed_out',
          responded_at = v_now
      WHERE id = v_offer_id
        AND status = 'offered';

      IF FOUND THEN
        v_expired := v_expired + 1;

        -- reset order กลับเป็น pending (ถ้ายังไม่ครบ MAX_DISPATCH_ROUNDS = 3)
        IF v_dispatch_round < 3 THEN
          UPDATE public.orders
          SET dispatch_status = 'pending'
          WHERE id = v_order_id
            AND dispatch_status = 'dispatching';

          IF FOUND THEN
            v_redispatched := v_redispatched + 1;
          END IF;
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE WARNING 'expire_dispatch_offers: error processing offer %: %',
          v_offer_id, sqlerrm;
    END;
  END LOOP;

  CLOSE v_cursor;

  RETURN QUERY
    SELECT v_expired::bigint, v_redispatched::bigint, v_errors::bigint, v_now;
END;
$$;

-- ============================================================================
-- Security: REVOKE และ GRANT สิทธิ์อย่างเหมาะสม
-- SECURITY DEFINER function ต้อง restrict สิทธิ์เข้าถึงอย่างเข้มงวด
-- ============================================================================

-- Revoke public execution access
REVOKE ALL ON FUNCTION public.expire_dispatch_offers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_dispatch_offers() FROM anon;
REVOKE ALL ON FUNCTION public.expire_dispatch_offers() FROM authenticated;

-- Grant execute only to service_role (ใช้โดย admin client ใน server actions)
GRANT EXECUTE ON FUNCTION public.expire_dispatch_offers() TO service_role;

-- อ้างอิง: KNOWLEDGE.md §7 Hard Rules — SECURITY DEFINER = ต้องเช็คสิทธิ์เอง
-- และ docs/03-rider-system-architecture.md §11.5 Accounting/Tax Review Gate

COMMENT ON FUNCTION public.expire_dispatch_offers() IS
  'Expire dispatch offers that have timed out, reset orders for redispatch. Called by /api/cron/dispatch-timeout every 1 minute. Uses advisory lock for concurrency safety. SECURITY DEFINER - restricted to service_role only.';
