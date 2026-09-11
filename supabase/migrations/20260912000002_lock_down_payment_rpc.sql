-- ==============================================================================
-- MIGRATION: 20260912000002_lock_down_payment_rpc.sql
-- ปิดช่องโหว่: verify_and_confirm_payment เปิดให้ anon/authenticated เรียกได้
--
-- ที่มา: Supabase Security Advisor (lint 0028 anon_security_definer_function_executable)
--
-- ปัญหา:
--   verify_and_confirm_payment เป็น SECURITY DEFINER และ "ไม่ตรวจสิทธิ์ผู้เรียกเลย"
--   มันเชื่อค่า p_amount / p_trans_ref ที่ส่งเข้ามาทั้งหมด
--   แต่ PostgREST เปิดให้เรียกผ่าน POST /rest/v1/rpc/verify_and_confirm_payment
--   ด้วย anon key ที่ติดไปกับ bundle ฝั่งเบราว์เซอร์ (NEXT_PUBLIC_SUPABASE_ANON_KEY)
--   => ใครก็ได้ยิงยืนยันว่าออเดอร์ไหนก็ได้ "จ่ายเงินแล้ว" โดยไม่ต้องโอนจริง
--
-- ผู้เรียกจริงในระบบใช้ service_role ทั้งคู่ (ตรวจแล้ว):
--   - src/app/actions/payment.ts       -> createAdminClient()
--   - src/app/api/webhooks/slipok/route.ts -> createAdminClient()
--   ดังนั้นการ revoke สิทธิ์ anon/authenticated ไม่กระทบ flow ใดๆ
-- ==============================================================================

revoke all on function public.verify_and_confirm_payment(uuid, numeric, text, jsonb) from public;
revoke all on function public.verify_and_confirm_payment(uuid, numeric, text, jsonb) from anon;
revoke all on function public.verify_and_confirm_payment(uuid, numeric, text, jsonb) from authenticated;
grant execute on function public.verify_and_confirm_payment(uuid, numeric, text, jsonb) to service_role;

-- pin search_path (SECURITY DEFINER ที่ search_path เปลี่ยนได้ = เสี่ยง schema hijack)
alter function public.verify_and_confirm_payment(uuid, numeric, text, jsonb)
  set search_path = public, extensions;

-- ==============================================================================
-- Trigger functions: pin search_path ตาม lint 0011 function_search_path_mutable
-- (ไม่ revoke สิทธิ์ เพราะเป็นฟังก์ชันที่ trigger เรียกใช้ — เลี่ยงความเสี่ยงของเดิม)
-- ==============================================================================
alter function public.handle_updated_at() set search_path = public, extensions;
alter function public.generate_order_no() set search_path = public, extensions;
alter function public.generate_order_no(uuid) set search_path = public, extensions;
