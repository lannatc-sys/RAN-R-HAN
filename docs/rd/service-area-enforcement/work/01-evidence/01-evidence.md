# Evidence Output: Claude architecture review with repository verification

## Assigned Scope

ตรวจความพร้อมของ schema/order/rider flow และเสนอขอบเขต MVP ที่ production-safe สำหรับ service-area enforcement โดย Claude เป็นผู้วิจารณ์แผนหนึ่งรอบแบบ read-only และ Codex ตรวจยืนยันข้อเท็จจริงกับไฟล์จริง

## Observations

- Repository มี PostGIS ใน schema `extensions`, พิกัดร้าน `shop_lat/shop_lng`, พิกัดลูกค้าใน `orders` และพิกัดปัจจุบันของไรเดอร์แบบ overwriteหนึ่งแถวต่อคน
- `create_pickup_order` เป็น `SECURITY DEFINER`; trigger `SHOP_CLOSED` แสดง pattern ที่ใช้บังคับกฎที่ database boundary ได้
- Location API ยังตรวจ auth/open session แล้ว upsert `rider_current_locations` โดยตรง จึงยังไม่มี transaction เดียวที่อัปเดตพิกัดและสถานะ geofence
- Start-session API ยังไม่รับ GPS และหน้า Rider เริ่ม `watchPosition` หลังมี open session เท่านั้น
- Offer accept และ close session ใช้ rider-scoped advisory lock เดียวกัน; close session ปิด session, ลบ current location และ reject pending offersโดยไม่ยกเลิก active assigned order

## Findings

| Finding ID | Observation Or Claim | Evidence | Confidence |
| --- | --- | --- | --- |
| E-01 | MVP ควรใช้วงกลมรัศมีจากพิกัดร้าน และแยกรัศมีลูกค้ากับรัศมีการทำงานไรเดอร์; polygon editor เลื่อนไป phase 2 | Claude review; PostGIS และ shop coordinates มีอยู่แล้วใน migrations | high |
| E-02 | ต้องบังคับ delivery geofence ใน database path ไม่ใช่ UI เท่านั้น เพื่อป้องกัน stale page/direct RPC | `20260906000001_pickup_mvp.sql`; `20260912000005_shop_open_status.sql`; `src/app/actions/order.ts` | high |
| E-03 | การรายงานพิกัดไรเดอร์ต้องย้ายไป RPC atomic ที่ถือ advisory lock เดียวกับ accept/close และคำนวณเวลาจาก `now()` ของ DB | `src/app/api/rider/location/route.ts`; `20260911000006_rider_concurrency_lock.sql` | high |
| E-04 | Countdown ต้องเก็บ timestamp ใน DB และมี cron sweep เพราะแอป/เน็ตอาจหยุดส่ง ping หลังได้รับ warning | Claude review; serverless runtime ไม่มี timer ถาวร; existing CRON_SECRET route pattern | high |
| E-05 | Start Work ต้องรับ GPS และปฏิเสธการเริ่มงานนอกเขต; flow ปัจจุบันต้องเปลี่ยนให้ขอพิกัดครั้งเดียวก่อน POST start | `src/app/api/rider/session/start/route.ts`; `src/app/rider/RiderClient.tsx` | high |
| E-06 | เมื่อกลับเข้าเขตก่อนครบ 15 นาที ต้อง clear `outside_area_since` แบบ idempotent; refresh หน้าเว็บต้องไม่เปลี่ยน deadline | Claude review; project architecture locks server timestamp as source of truth | high |
| E-07 | เมื่อครบเวลา การปิด session ต้อง serialize กับ offer acceptance; ถ้าปิดก่อน accept ต้อง fail ด้วย session-required ถ้า accept ก่อน active order ต้องไม่ถูกยกเลิกโดย geofence close | `respond_to_dispatch_offer`; `close_rider_work_session` in concurrency migration | high |
| E-08 | API response จาก location ping เพียงพอสำหรับ MVP warning UI; ไม่ต้องเพิ่ม realtime/WebSocket และไม่ควรเก็บ countdown ใน memory | Claude review | high |
| E-09 | ค่า enable ต้อง default ปิดสำหรับร้านเดิม และเปิดได้เมื่อมีพิกัดร้านและรัศมีที่ valid เพื่อให้ migration/rollout ปลอดภัย | Inference from additive migration rule and existing shops that may lack coordinates | high |

## Sources

| Source | Claim Supported | Access/Verification Note |
| --- | --- | --- |
| Claude CLI 2.1.269.0 planning response | Radius MVP, DB timestamp, atomic RPC, shared lock, cron fallback, acceptance cases | 2026-09-12; second focused pass completed, tools disabled |
| `supabase/migrations/20260911000001_rider_system.sql` | Rider/session/location schema and PostGIS | Local source read 2026-09-12 |
| `supabase/migrations/20260911000006_rider_concurrency_lock.sql` | Shared rider advisory lock and close behavior | Local source read 2026-09-12 |
| `supabase/migrations/20260906000001_pickup_mvp.sql` | Authoritative order creation RPC and delivery coordinates | Local source read 2026-09-12 |
| `supabase/migrations/20260912000005_shop_open_status.sql` | Existing DB-boundary trigger pattern | Local source read 2026-09-12 |
| `src/app/api/rider/location/route.ts` | Current direct location upsert gap | Local source read 2026-09-12 |
| `src/app/api/rider/session/start/route.ts` | Current start flow lacks GPS | Local source read 2026-09-12 |
| `src/app/rider/RiderClient.tsx` | Current GPS watch begins only after session opens | Local source read 2026-09-12 |

## Inferences And Assumptions

- Inference: A single center point with two independently configurable radii is the smallest model that matches both “พื้นที่ให้บริการ” and “พื้นที่การทำงาน” without polygon complexity.
- Inference: Auto-close must reject pending offers but retain already assigned/in-transit orders, matching existing close semantics and avoiding silent customer reassignment.
- Assumption: Shop owners will explicitly enable each boundary after setting a valid shop coordinate and radius; no existing shop is auto-enabled by migration.

## Risks And Unknowns

- A rider can only be detected outside the area after the device reports GPS; if the device stops reporting while last known inside, no system can prove the rider moved outside.
- Closing a work session during an active delivery stops further work-session-based GPS collection. The assigned order remains accessible/assigned under current APIs; field testing must confirm this UX is acceptable.
- Cron scheduling is an operational dependency separate from implementing the protected endpoint/RPC and is not deployed in this workflow.

## Questions And Handoffs

- Plan owner should use two radii, safe-disabled defaults, an atomic location-report RPC, an atomic start-session RPC, and a cron sweep that reuses the same close helper/lock rather than duplicating close behavior.
- Preserve the limitation about active delivery GPS and do not silently cancel or reassign active orders.
