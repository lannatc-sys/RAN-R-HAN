# 🤝 Project Handoff & Status Log (RAN-R-HAN)

> **บันทึกสถานะการส่งมอบงาน (Handoff Document)**  
> **วันเวลาที่อัปเดตล่าสุด:** 2026-09-12 (GMT+7) — Pre-Pilot Verification Audit Completed
> **สถานะภาพรวม:** 🟡 CONDITIONALLY PILOT-READY (โค้ดและชุดทดสอบ Unit/Scenario ผ่านครบทุกหมวด A ถึง H แต่มี Production Blockers ที่ต้องเปิดใช้งานบนระบบจริง: 1) รัน migration 20260912000004 บน Supabase, 2) ตั้ง external cron scheduler, 3) บันทึกพิกัดร้านค้าจริง, 4) สร้างบัญชีไรเดอร์อย่างน้อย 2 คน, 5) REAL DEVICE E2E: NOT VERIFIED ยังไม่เคยทดสอบบนอุปกรณ์มือถือจริงหน้างาน)
> *เอกสารฉบับนี้ถูกซิงก์กับ [docs/HANDOFF.md](file:///d:/system%20make/Ran-R-HAN/docs/HANDOFF.md)*

---

## 📌 1. สรุปสถานะล่าสุดของโปรเจกต์ (Executive Summary)

โปรเจกต์ **RAN-R-HAN (รับอาหาร)** เป็นระบบร้านอาหาร Multi-tenant SaaS สำหรับร้านอาหารท้องถิ่นในเขตเทศบาลเมืองแม่ฮ่องสอน  
ปัจจุบันได้รับการพัฒนา ฟีเจอร์หลักครบถ้วน และผ่านการทดสอบทุกระดับ:
- **ระบบสั่งอาหารและหน้าร้าน (Customer Order & Dine-in/Takeaway)**: ทำงานสมบูรณ์
- **ระบบครัว KDS (Kitchen Display System)**: แสดงคิวอาหารเรียลไทม์ พร้อมระบบล็อกหน้าจอด้วย PIN 4 หลัก
- **ระบบตรวจสอบการชำระเงิน (PromptPay & SlipOK)**: ป้องกันสลิปซ้ำ (Code 23505) และเข้ารหัส API Key ด้วย AES-256-GCM
- **ระบบจัดส่งและพรีออเดอร์ (Zone & Delivery / Preorder)**: ตาม [docs/router-map.md](file:///d:/system%20make/Ran-R-HAN/docs/router-map.md) รองรับจุดรับในแม่ฮ่องสอน แผนที่ Leaflet.js (OpenStreetMap) ฟรี 100% และระบบ Smart Facebook Comment Parser
- **ระบบความปลอดภัยทางกฎหมายและการคุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance: WP-19 ถึง WP-23)**: ติดตั้งหน้าข้อกำหนดจริง, จุดขอ Consent ที่บันทึกหลักฐาน Timestamp, ระบบ Audit Log, Data Retention ลบข้อมูลอัตโนมัติตามกรอบ 90 วัน, และแบบฟอร์มยื่นคำขอใช้สิทธิของเจ้าของข้อมูล (DSR 8 สิทธิ)

---

## 🛠️ 2. สิ่งที่ได้รับการพัฒนาและปรับปรุงล่าสุด (Recent Updates)

### A. ระบบกฎหมายและ PDPA Compliance (WP-19 ถึง WP-23) — *เสร็จสิ้นล่าสุด 🎯*
1. **หน้าเว็บจริงสำหรับข้อกำหนดและนโยบาย (WP-19):**
   - [`/terms`](file:///d:/system%20make/Ran-R-HAN/src/app/terms/page.tsx) และ [`/privacy`](file:///d:/system%20make/Ran-R-HAN/src/app/privacy/page.tsx) — หน้าระดับแพลตฟอร์ม
   - [`/[slug]/terms`](file:///d:/system%20make/Ran-R-HAN/src/app/%5Bslug%5D/terms/page.tsx) และ [`/[slug]/privacy`](file:///d:/system%20make/Ran-R-HAN/src/app/%5Bslug%5D/privacy/page.tsx) — หน้าระดับร้านค้า แสดงชื่อผู้ควบคุมข้อมูลและช่องทางติดต่อจริง
   - ลิงก์ Legal Footer ในหน้าเมนูร้านค้า [`MenuClient.tsx`](file:///d:/system%20make/Ran-R-HAN/src/app/%5Bslug%5D/MenuClient.tsx)
2. **จุดขอความยินยอมและการบันทึกหลักฐาน Consent Logging (WP-20):**
   - Checkbox บังคับยินยอมข้อกำหนดและนโยบายก่อนยืนยันสั่งซื้อใน [`CheckoutClient.tsx`](file:///d:/system%20make/Ran-R-HAN/src/app/%5Bslug%5D/checkout/CheckoutClient.tsx) (ปุ่มกดสั่งซื้อจะถูก Disabled จนกว่าจะกดยินยอม)
   - บันทึกหลักฐานลงตาราง `consent_logs` (Timestamp, ประเภทความยินยอม, เวอร์ชันนโยบาย, IP/User-Agent) ทั้งเงื่อนไข ToS และการกดยินยอมแชร์พิกัด GPS
3. **Audit Logging & Preorder Notice (WP-21):**
   - บันทึก `audit_logs` อัตโนมัติทุกครั้งที่มีการนำเข้าคอมเมนต์ Facebook ใน `addBulkPreorderItemsAction`
   - แบนเนอร์คำแนะนำข้อความ Consent แปะในโพสต์ Facebook ก่อนเปิดรับคอมเมนต์ ในหน้า [`PreorderRoundDetailClient.tsx`](file:///d:/system%20make/Ran-R-HAN/src/app/admin/delivery/preorder/%5Bid%5D/PreorderRoundDetailClient.tsx)
4. **ระบบทำลายข้อมูลอัตโนมัติ (Automated Data Retention - WP-22):**
   - Endpoint [`/api/cron/data-retention`](file:///d:/system%20make/Ran-R-HAN/src/app/api/cron/data-retention/route.ts) ตรวจสอบความปลอดภัยด้วย `CRON_SECRET`
   - ลบออเดอร์ที่ยกเลิกเกิน 90 วัน, ล้างข้อความดิบคอมเมนต์ Facebook เก่ากว่า 90 วัน, ลบ Audit Log เก่ากว่า 1 ปี, และคุ้มครองข้อมูลทางบัญชี/ภาษี 5-7 ปี
5. **แบบฟอร์มขอใช้สิทธิของเจ้าของข้อมูล (Data Subject Rights - WP-23):**
   - คอมโพเนนต์ [`DataSubjectRequestForm.tsx`](file:///d:/system%20make/Ran-R-HAN/src/components/legal/DataSubjectRequestForm.tsx) รองรับสิทธิ 8 ประการตาม PDPA พร้อมระบบบันทึกลงตาราง `data_subject_requests` กำหนดส่งมอบผลภายใน 30 วัน

### B. แก้ไขข้อผิดพลาด PinModal ([src/components/admin/PinModal.tsx](file:///d:/system%20make/Ran-R-HAN/src/components/admin/PinModal.tsx))
- ปรับปรุงให้เรียกเฉพาะ `onSuccess()` เมื่อรหัส PIN ถูกต้อง ทำให้หน้าจอยังคงอยู่ที่ `/admin/settings` ไม่เด้งกลับไปหน้าแรก

### C. ระบบจัดส่งและพรีออเดอร์ (Zone & Delivery System)
- Database Migrations: [`supabase/migrations/20260910000001_delivery_system.sql`](file:///d:/system%20make/Ran-R-HAN/supabase/migrations/20260910000001_delivery_system.sql)
- Smart Facebook Comment Parser: [`src/lib/delivery-parser.ts`](file:///d:/system%20make/Ran-R-HAN/src/lib/delivery-parser.ts)

### D. รายงานรีวิวโครงการ (Project Review Report) — *เสร็จสิ้นล่าสุด 📋*
- สร้าง [`docs/REPORTREVIEW.MD`](file:///d:/system%20make/Ran-R-HAN/docs/REPORTREVIEW.MD) — รีวิวภาพรวมโครงการครบทุกด้าน: Architecture, Feature Review, Security Assessment, Quality Gate (53/53), Gaps & Risks (🔴/🟠/🟡), Deployment Checklist, Next Steps

### E. พัฒนาระบบแจ้งเตือนและตั้งค่า Telegram Bot ครบวงจร (@ranrhan_bot) — *เสร็จสิ้น Phase 1-6 🎯*
- **วัตถุประสงค์:** ส่งการแจ้งเตือนสถานะออเดอร์ (1-on-1) ถึงลูกค้าโดยตรงผ่าน Telegram Bot ฟรี 100%
- **ข้อมูลบอทที่เชื่อมต่อ:**
  - Bot Name: `RAN-R-HAN`
  - Bot Username: `@ranrhan_bot` (ID: `8740185324`)
  - Deep Link URL: `https://t.me/ranrhan_bot?start=<TOKEN>`
- **สิ่งที่พัฒนาและทดสอบเรียบร้อย:**
  1. **Database Migration (`supabase/migrations/20260910000003_telegram_notifications.sql`):**
     - เพิ่มคอลัมน์ `telegram_enabled` ในตาราง `shops` (default: TRUE)
     - เพิ่มคอลัมน์ `telegram_chat_id` ในตาราง `orders`
     - สร้างตาราง `telegram_link_tokens` พร้อม Index และ RLS (Token อายุ 15 นาที)
     - รัน Migration ผ่าน `scripts/run-db.js` สำเร็จบน Supabase เรียบร้อย
  2. **Backend Library ([`src/lib/telegram.ts`](file:///d:/system%20make/Ran-R-HAN/src/lib/telegram.ts)):**
     - `sendTelegramMessage()`, `sendOrderStatusMessage()`, `sendTestTelegramMessage()`
     - เทมเพลตข้อความ 5 สถานะ (`confirmed`, `cooking`, `served`, `completed`, `cancelled`) รองรับ TH/EN
     - ทำงานแบบ Graceful Handling ไม่ทำให้ flow ออเดอร์หลักหยุดชะงัก
  3. **Webhook Endpoint ([`src/app/api/telegram/webhook/route.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/api/telegram/webhook/route.ts)):**
     - รับ Event จาก Telegram Bot แกะ Token จาก `/start <TOKEN>` ตรวจสอบอายุและสถานะใช้งาน
     - บันทึก `orders.telegram_chat_id` และตอบกลับลูกค้าทันที
  4. **Server Actions:**
     - [`src/app/actions/telegram.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/actions/telegram.ts): สร้าง Deep Link, เปิด/ปิดแจ้งเตือนร้าน, ทดสอบส่งข้อความ
     - [`src/app/actions/order.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/actions/order.ts): ยิงแจ้งเตือนลูกค้าอัตโนมัติใน `updateOrderStatusAction()` และ `confirmCashPaymentAction()`
  5. **Frontend UI:**
     - **Admin Settings:** การ์ด "ระบบแจ้งเตือนลูกค้าผ่าน Telegram Bot" ใน [`SettingsClient.tsx`](file:///d:/system%20make/Ran-R-HAN/src/app/admin/settings/SettingsClient.tsx) พร้อมสวิตช์เปิด/ปิดร้าน และกล่องทดสอบส่งข้อความ
     - **Customer Order Tracking:** การ์ดเชื่อมต่อรับแจ้งเตือน Telegram ใน [`OrderTrackerClient.tsx`](file:///d:/system%20make/Ran-R-HAN/src/app/order/%5BorderId%5D/OrderTrackerClient.tsx) แสดงสถานะเชื่อมต่อแบบเรียลไทม์

### F. ระบบอัปโหลดและตรวจสอบสลิปอัตโนมัติ (SlipOK Direct Verification) — *เสร็จสิ้นล่าสุด 🎯*
- **วัตถุประสงค์:** แก้ปัญหาผู้ใช้แจ้งว่า *"ตรวจสอบการโอนเงิน ไม่มีให้แนบสลิปเพื่อตรวจสอบกับ สลิปโอเค"* โดยเพิ่มช่องทางให้ลูกค้าแนบรูปสลิปจากมือถือเพื่อตรวจสอบกับ SlipOK API ทันทีหลังโอนเงิน
- **สิ่งที่พัฒนาและทดสอบเรียบร้อย:**
  1. **Server Action ตรวจสอบสลิป ([`src/app/actions/payment.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/actions/payment.ts)):**
     - ฟังก์ชัน `uploadAndVerifySlipAction(formData: FormData)`:
     - ตรวจสอบความถูกต้องของไฟล์รูปภาพ (ขนาดสูงสุด 10MB, mime type `image/*`)
     - ดึง `api_key_encrypted` จากตาราง `shop_payment_credentials` และถอดรหัส AES-256-GCM ฝั่งเซิร์ฟเวอร์
     - ยิง HTTP POST แบบ multipart/form-data ไปยัง SlipOK API พร้อมแนบ Header `x-authorization`
     - ตรวจสอบความถูกต้องของยอดเงิน (`slipAmount >= order.total`) และบัญชีปลายทาง Exact Match (PromptPay/บัญชีธนาคาร)
     - เรียก Supabase RPC `verify_and_confirm_payment` บันทึก Transaction Reference ป้องกันการใช้สลิปซ้ำ (Code 23505)
     - สำรองรูปสลิปไปยัง Supabase Storage bucket `payment-slips` (Best-effort)
     - ยิง Web Push แจ้งเตือนครัว/ร้านค้า (`sendPushToShop`) และแจ้งสถานะออเดอร์ผ่าน Telegram Bot ถึงลูกค้าทันที
  2. **Frontend UI แนบสลิป ([`OrderTrackerClient.tsx`](file:///d:/system%20make/Ran-R-HAN/src/app/order/%5BorderId%5D/OrderTrackerClient.tsx)):**
     - กล่องแนบรูปสลิปโอนเงิน (JPG, PNG, WEBP) พร้อมพรีวิวรูป และปุ่มเปลี่ยนรูป
     - ปุ่มกดยืนยันตรวจสลิปทันทีพร้อมสถานะ Loading
     - แสดงข้อความแจ้งเตือน Error ภาษาไทยชัดเจน (สลิปซ้ำ, บาร์โค้ดไม่ชัด, ยอดไม่ตรง ฯลฯ)
     - ปรับสถานะเป็น Verified Badge ทันทีเมื่อผ่านการตรวจสอบ
  3. **ระบบภาษา (i18n):**
     - เพิ่มคีย์แปลภาษา TH/EN สำหรับ UI ตรวจสลิปใน [`src/lib/i18n/translations.ts`](file:///d:/system%20make/Ran-R-HAN/src/lib/i18n/translations.ts)

### G. ระบบไรเดอร์และการจ่ายงาน (Rider & Dispatch System) — *P0 Hardening เสร็จแล้ว; ยังไม่ Production Ready*
- **วัตถุประสงค์:** เปิดใช้ระบบส่งอาหารด้วยไรเดอร์ตามเอกสาร [docs/03-rider-system-architecture.md](file:///d:/system%20make/Ran-R-HAN/docs/03-rider-system-architecture.md)
- **Database (รันลง Supabase เรียบร้อยแล้ว):**
  - เปิด Extension `postgis` (schema `extensions`) และสร้าง 9 ตารางหลัก: `riders`, `rider_work_sessions`, `rider_current_locations` (PostGIS + GiST index), `dispatch_offers`, `delivery_events`, `pod_uploads`, `daily_settlements`, `settlement_line_items`, `rider_pool_ledger`
  - เพิ่มคอลัมน์ในตาราง `orders`: `assigned_rider_id`, `dispatch_status`, `delivery_fee`, `estimated_distance_km`
  - เพิ่มคอลัมน์พิกัดร้าน `shops.shop_lat` / `shops.shop_lng` (จุดศูนย์กลางค้นหาไรเดอร์)
  - สร้าง Storage bucket `pod-uploads` แบบ Private พร้อม RLS (ห้าม Public Link ตาม §9.2)
  - Migration: `20260911000001` ถึง `20260911000006` (`00005`–`00006` P0 hardening รันบน Supabase แล้ว)
- **บั๊กที่ตรวจพบและแก้ก่อนรัน (Review Gate):**
  1. Migration เรียก `set_updated_at()` ที่ไม่มีจริงในโปรเจกต์ → แก้เป็น `handle_updated_at()`
  2. RPC ตั้ง `search_path = public` แต่ PostGIS อยู่ schema `extensions` → ระบบหาไรเดอร์จะพังทุกครั้ง → แก้เป็น `public, extensions`
  3. `find_available_riders` เป็น SECURITY DEFINER แต่ไม่เช็คสิทธิ์ร้าน → ใครก็ดูพิกัดไรเดอร์ร้านอื่นได้ → เพิ่มเงื่อนไข `has_shop_access()` (ยกเว้น service_role)
  4. `p_exclude_rider_ids` เป็น NULL ทำให้ query ไม่คืนไรเดอร์เลย → ใส่ `coalesce(..., '{}')`
  5. สรุปยอดรายวันใช้เวลา UTC → แก้เป็นเวลาไทย `Asia/Bangkok`
  6. RLS เดิมยังให้ไรเดอร์ `update` ทุกคอลัมน์ใน `dispatch_offers` → ถอนสิทธิ์เขียนตรงทั้งหมดและบังคับผ่าน transactional RPC
  7. Dispatch ค้นหาไรเดอร์รอบ "พิกัดลูกค้า" แทน "พิกัดร้าน" → แก้ให้ยึดพิกัดร้านเป็นจุดรับอาหาร
  8. Race condition: `.update()` ของ supabase-js ไม่ error เมื่อไม่โดนแถวไหน → เพิ่ม `.select()` ตรวจจำนวนแถว (Compare-and-Swap) ทั้งตอนรับงาน/ปฏิเสธ/หมดเวลา
- **P0 hardening (`20260911000005`–`20260911000006`):**
  - `respond_to_dispatch_offer()` ล็อกระดับไรเดอร์ + Offer + Order, ตรวจ Timeout/Work Session/ความจุ 2 งาน และ Assign แบบ atomic; การรับหลาย Offer พร้อมกันจะถูก serialize ไม่ให้เกิน Capacity
  - `close_rider_work_session()` ใช้ล็อกระดับไรเดอร์ชุดเดียวกัน จึงไม่ชนกับการ Accept Offer ที่เกิดพร้อมกัน
  - `close_rider_work_session()` ปิด Session + ลบ GPS + ยกเลิก Offer ใน transaction เดียว
  - `finalize_rider_delivery_event()` ตรวจ State + lock/claim POD + ปิด Order ใน transaction เดียว ป้องกัน POD ซ้ำ
  - ถอน direct write ของ Rider ต่อ Offer/Event/POD metadata และถอน direct read ของไฟล์ POD
  - จำกัด internal `SECURITY DEFINER` RPC ให้ `service_role` และแทนสูตร 80/20 ด้วย Base Rate 15 บาท/5 กม.; ระยะเกินหรือไม่ทราบถูก Flag รอ Review
- **หน้าไรเดอร์ (Rider PWA) — ของใหม่รอบนี้:**
  - [`/rider/login`](file:///d:/system%20make/Ran-R-HAN/src/app/rider/login/page.tsx) — เข้าสู่ระบบสำหรับไรเดอร์
  - [`/rider`](file:///d:/system%20make/Ran-R-HAN/src/app/rider/RiderClient.tsx) — ปุ่มเริ่มงาน/ปิดงาน, ส่งพิกัด GPS อัตโนมัติ (Idle 60 วิ / ระหว่างส่ง 15 วิ, หยุดทันทีเมื่อปิดงานตาม PDPA), การ์ดงานใหม่พร้อมนับถอยหลัง, ปุ่มไล่สถานะงาน 5 ขั้น, ปุ่มนำทาง Google Maps และโทรหาลูกค้า, แนบภาพ POD, สรุปงาน/ค่าตอบแทนวันนี้ — รองรับ TH/EN, Dark Mode และมือถือตั้งแต่ 320px
  - Logic ล้วน (ทดสอบได้) แยกไว้ที่ [`src/lib/rider.ts`](file:///d:/system%20make/Ran-R-HAN/src/lib/rider.ts)
- **API ใหม่:** `GET /api/rider/offers/active`, `GET /api/rider/orders/active`, `GET /api/rider/summary`, `GET|POST /api/cron/dispatch-timeout` (ป้องกันด้วย `CRON_SECRET`)
- **กฎที่บังคับฝั่งเซิร์ฟเวอร์ (ไม่เชื่อฝั่งมือถือ):**
  - ปิดงานแบบ "ส่งสำเร็จ" หรือ "ติดต่อลูกค้าไม่ได้" **ต้องอัปโหลดภาพ POD สำเร็จก่อนเสมอ** (§9.1) — อัปโหลดพลาด = งานยังไม่ถูกปิด
  - กดข้ามขั้น/กดซ้ำไม่ได้ (State Guard `isValidRiderEventTransition`)
  - รับงานได้เฉพาะตอนมี Work Session เปิดอยู่ (§6 Online-First) และปิดงานจะยกเลิก Offer ที่ค้างอยู่ทันที
  - เวลาและพิกัดยึดจากเซิร์ฟเวอร์เป็นหลัก (`server_received_at`)

### H. Dispatch Timeout — Atomic RPC + Hardening ([PR #1](https://github.com/lannatc-sys/RAN-R-HAN/pull/1)) — *ตรวจสอบล่าสุด 2026-09-12*

- **ปัญหาเดิม:** `timeoutOfferAction()` เดิม query offers ที่หมดเวลาแล้ววน loop update ทีละแถวจาก JS — เปิดช่องให้ cron วิ่งซ้อนกัน (concurrent run) แก้ไข offer เดียวกันพร้อมกัน และถ้า RPC/DB error จะถูกกลืนเงียบเป็น "1 error" มองจากภายนอกเหมือนสำเร็จ
- **แก้แล้ว (migration [`20260912000001_dispatch_timeout_atomic.sql`](file:///d:/system%20make/Ran-R-HAN/supabase/migrations/20260912000001_dispatch_timeout_atomic.sql)):**
  1. ย้าย logic ทั้งหมดเข้า RPC เดียว `expire_dispatch_offers()` — ใช้ `pg_try_advisory_xact_lock` กันสอง cron รันซ้อน + `FOR UPDATE` ล็อกแถวระหว่างประมวลผล ทำงานใน transaction เดียวจึง atomic
  2. จำกัดสิทธิ์ `SECURITY DEFINER`: `REVOKE ALL` จาก `public`/`anon`/`authenticated`, `GRANT EXECUTE` ให้ `service_role` เท่านั้น
  3. `search_path` ตั้งผ่าน SET clause ของตัวฟังก์ชัน (ไม่ใช่ `SET` ใน body) — กัน search_path รั่วไปติด connection อื่นตอน pool reuse (Supavisor/PgBouncer transaction mode)
  4. `timeoutOfferAction()` และ `/api/cron/dispatch-timeout` เปลี่ยนจาก "กลืน error คืนศูนย์" เป็น **throw / ตอบ 502** เมื่อ RPC ล้มเหลวจริง — จุดเรียกแบบ opportunistic sweep ใน `dispatchOrderAction` ยังคง try/catch แบบ non-critical ตามเดิม
  5. เพิ่ม regression test 18 รายการ (`test/cron-dispatch-timeout.test.ts`) ผูกเข้า `npm test`/`test:unit` แล้ว (ของเดิมมีไฟล์แต่ไม่เคยถูกเรียกจากสอง script นี้)
  6. เพิ่ม `scripts/validate-migration.js` (เช็คโครงสร้างไฟล์ SQL แบบ static ไม่แตะ DB) และ `scripts/verify-rpc.js` (เช็คจริงกับ DB ผ่าน `DATABASE_URL` — **รันแล้วจะ mutate ข้อมูลจริง** ต้องระวังว่าเล็งไปที่ DB ไหน)
- **ตรวจสอบกับ Production จริง (Supabase project `RAN-R-HAN` / `hqfzahyvwsjrvlgvaxda`) แล้วพบ:**
  - ✅ `expire_dispatch_offers()` มีอยู่จริง, `SECURITY DEFINER = true`, สิทธิ์ EXECUTE เหลือแค่ `postgres` (owner) + `service_role` ตรงตามที่ตั้งใจ
  - ระหว่างตรวจครั้งแรกพบว่าโค้ดที่รันอยู่จริงยังเป็นเวอร์ชันก่อนย้าย `SET search_path` มาเป็น function attribute — ผู้ใช้ paste SQL รันเองใน Supabase Dashboard → SQL Editor แล้ว (`Success. No rows returned`)
  - **✅ ยืนยันแล้วว่า sync ตรงกับ PR #1 ล่าสุด:** `proconfig` ของฟังก์ชันบน production คือ `search_path=public, extensions` ตรงกับ commit `0fe31e7`, สิทธิ์ EXECUTE ยังเหลือแค่ `postgres`/`service_role` เหมือนเดิม — ปิดรายการนี้แล้ว

### I. External Review (CODEX) — P0/P1 Fixes ([PR #1](https://github.com/lannatc-sys/RAN-R-HAN/pull/1)) — *ปิดครบแล้ว 2026-09-12*

รับรีวิวจากภายนอก (CODEX) บน PR #1 ที่ commit `0bccbe0` พบ P0 2 ข้อ + P1 หลายข้อ ตรวจสอบแต่ละข้อกับโค้ด/ฐานข้อมูลจริงก่อนแก้ (ไม่เชื่อรายงานเปล่าๆ) แล้วปิดครบ:

- **P0 #1 (`6b8e693`):** `data-retention` cron ลบออเดอร์ยกเลิกเกิน 90 วันโดยไม่เช็ค payment status — และ `payments.order_id` เป็น `ON DELETE CASCADE` แปลว่าลบ order = ลบหลักฐานจ่ายเงินทิ้งถาวร แก้ให้เช็คก่อนว่ามี payment ที่ `verified` ไหม
- **P0 #2 (`6b8e693`, เสริมด้วย `e18bf1b`):** `scripts/run-db.js` (path `npm run db:setup`) ข้าม rider migrations ทั้ง 6 ไฟล์และ `lock_down_payment_rpc` เพิ่มเข้าไปครบ, ภายหลังพบว่าเมื่อรันจริงกับ production ที่มี migration เก่าอยู่แล้ว `CREATE POLICY` (ไม่มี `IF NOT EXISTS`) ทำให้ script abort ทั้งชุด — refactor เป็น `runMigrationFile()` helper ที่ skip error class "already exists" (`42710`/`42P07`/`42723`/`42701`) แทนการ abort
- **P1 (`739fdae`):** `verify-rpc.js` exit 0 แม้ check ล้มเหลว (แก้ให้ exit 1), rider session-start แข่งกันแล้วได้ 500 แทนคืน session เดิม (จับ `23505` แล้ว re-select), dispatch race — เพิ่ม partial unique index `uq_dispatch_offers_one_active_per_order` (`WHERE status='offered'`) กัน order เดียวมี offer active ซ้ำ + reorder timeout sweep ให้รันก่อน mark `dispatching` กันสถานะโดน undo, PII (เบอร์โทรไรเดอร์) หลุดใน log
- **ยืนยันกับ production จริงครบทุกจุด:** `verify_and_confirm_payment()` และ trigger function ทั้ง 3 ตัวมี `search_path` pin ถูกต้อง, สิทธิ์ EXECUTE จำกัดแค่ `service_role`, index `uq_dispatch_offers_one_active_per_order` มีอยู่จริงบน `dispatch_offers`

### J. ปิดงานเตรียมความพร้อม Pilot จริง (System Readiness to Pilot Mission — Components A ถึง H) — *เสร็จสิ้นสมบูรณ์ 🎯*

ดำเนินงานปิดงานค้างทางเทคนิคทุกด้านตามข้อกำหนด System Readiness to Pilot Mission:

1. **Component A — Rider Notification จริง (Web Push + Telegram Bot):**
   - Migration `20260912000004_rider_telegram_notification.sql` เพิ่มคอลัมน์ `telegram_chat_id` (bigint) และ `push_enabled` (boolean) พร้อม Partial Index บนตาราง `riders`
   - เพิ่มขั้นตอน migration `1.14` ใน `scripts/run-db.js`
   - พัฒนาโมดูล `src/lib/rider-notification.ts` รองรับการแจ้งเตือนแบบคู่ขนาน: Web Push (Primary จาก `push_subscriptions` ที่ผูกกับ `auth_user_id`) และ Telegram Bot `@ranrhan_bot` (Fallback/Supplement)
   - เชื่อมต่อ `notifyRiderNewOffer()` เข้ากับ `dispatchOrderAction` แทน stub log เดิม
   - เพิ่ม `PushNotificationPrompt` ใน `src/app/rider/RiderClient.tsx`
   - ชุดทดสอบ Unit Test: `test/rider-notification.test.ts` (5/5 PASS)

2. **Component B — External Cron Hardening & Documentation:**
   - ตรวจสอบความปลอดภัย `/api/cron/dispatch-timeout/route.ts` บังคับ Bearer `CRON_SECRET`
   - คืน HTTP 502 เมื่อ atomic RPC `expire_dispatch_offers` เกิดข้อผิดพลาดร้ายแรง ไม่กลืน error
   - ตรวจสอบคู่มือการติดตั้ง `docs/cron-setup-guide.md` (ครอบคลุม cron-job.org, GitHub Actions, Vercel Cron)
   - ชุดทดสอบ Regression Tests: `test/cron-dispatch-timeout.test.ts` (18/18 PASS)

3. **Component C — Store Geo Coordinates & Strict Dispatch Validation:**
   - เพิ่มฟิลด์ `shop_lat?: number | null; shop_lng?: number | null;` ใน Interface `Shop` (`src/lib/types.ts`)
   - พัฒนา Server Action `updateShopGeoAction` ใน `src/app/actions/settings.ts` ตรวจสอบพิกัด -90..90 และ -180..180 แบบ Pair Validation พร้อมกัน
   - เพิ่ม Store Location Card ใน `/admin/settings` (`SettingsClient.tsx`) มีปุ่มดึงพิกัด GPS อัตโนมัติจากเบราว์เซอร์ และลิงก์พรีวิวบน OpenStreetMap
   - ปรับปรุง `dispatchOrderAction` ใน `src/app/actions/dispatch.ts`: ปฏิเสธการ Dispatch ทันทีหากร้านค้าไม่มีพิกัด โดยแสดง Error ภาษาไทยชัดเจน ไม่แอบ Fallback ไปหาพิกัดลูกค้าใน Production (เปิดช่องทาง Bypass เฉพาะ Local Dev ผ่าน `ALLOW_GEO_FALLBACK=true`)
   - ชุดทดสอบ Unit Test: `test/store-geo.test.ts` (6/6 PASS)

4. **Component D — Rider Account Management UI & Provisioning:**
   - พัฒนา Server Actions ใน `src/app/actions/rider-admin.ts`: `createRiderAction` และ `updateRiderStatusAction`
   - รองรับการสร้างบัญชี Supabase Auth ทันทีผ่าน `adminClient.auth.admin.createUser` พร้อมตั้งรหัสผ่านและ `email_confirm: true` และผูก `auth_user_id` เข้ากับแถวใน `riders`
   - อัปเดต `src/app/admin/riders/page.tsx` และ `RidersClient.tsx` เพิ่ม Modal "เพิ่มไรเดอร์ใหม่" สวิตช์สลับสถานะ On Duty/Off Duty/Suspended และแสดงสถานะการเชื่อมต่อ Telegram / Web Push

5. **Component E — SlipOK Production Webhook Security & Verification:**
   - ตรวจสอบความปลอดภัย `/api/webhooks/slipok/route.ts` และ `src/app/actions/payment.ts`
   - ตรวจสอบ Secret Header `x-slipok-secret` / `x-webhook-secret`, บัญชีปลายทาง Exact Match (ตัดอักขระพิเศษ), การคืนรหัส HTTP 409 DUPLICATE_SLIP สำหรับข้อผิดพลาด PostgreSQL Code `23505`
   - ตรวจสอบ Zero Secret Leakage: API key และ Webhook secret ไม่เคยถูกส่งออกไป client หรือ log
   - ชุดทดสอบ Unit Test: `test/slipok-webhook.test.ts` (5/5 PASS)

6. **Component F — Automated Lifecycle Scenario Simulation (REAL DEVICE E2E: NOT VERIFIED):**
   - **ข้อจำกัดสำคัญ:** ชุดทดสอบนี้เป็นการจำลองสถานการณ์และวงจรสถานะผ่าน Node.js in-memory runner (`test/rider-e2e-scenarios.test.ts`) **ไม่ใช่การทดสอบบนอุปกรณ์มือถือจริงหน้างาน (REAL DEVICE E2E: NOT VERIFIED)** ซึ่งยังต้องดำเนินการทดสอบจริงในแม่ฮ่องสอนก่อน
   - พัฒนาชุดทดสอบจำลองสถานการณ์ 15 เคสใน `test/rider-e2e-scenarios.test.ts`:
     - Happy Path วงจรสถานะออเดอร์และเหตุการณ์ไรเดอร์
     - การหมดเวลาและ Sequential Redispatch
     - Capacity Limit สูงสุด 2 ออเดอร์
     - การปฏิเสธ Duplicate Delivery Events
     - กรณีติดต่อลูกค้าไม่ได้ (Unreachable Drop) และ Safe Drop POD
     - กรณีรถเสีย/เหตุฉุกเฉิน (Breakdown)
     - ความถี่การส่ง GPS (Idle 60s vs Active 15s) และการหยุดส่งทันทีเมื่อปิด Session ตาม PDPA
     - กฎ Base Rate 15 บาท / 5 กม. แรก และการ Flag `PENDING_REVIEW` เมื่อระยะทางเกิน 5 กม. หรือไม่มีระยะทาง
   - ชุดทดสอบ Scenario: `test/rider-e2e-scenarios.test.ts` (15/15 PASS ใน runner)

7. **Component G — Legal & Financial Decision Gate:**
   - ตรวจสอบร่างเอกสารทั้ง 9 ฉบับใน `docs/legal-financial-drafts.md` (Privacy Policy, Terms of Service, Customer Terms, Merchant Terms, Rider Terms, PDPA Consent, Refund/Cancellation, Safe Drop, Settlement Policy)
   - ทุกเอกสารกำกับด้วยหัวเรื่อง `⚠️ DRAFT FOR PROFESSIONAL LEGAL REVIEW`
   - กำกับ Callout `⚠️ LEGAL/FINANCIAL DECISION REQUIRED` ทุกจุดที่ต้องรอการตัดสินใจของผู้มีอำนาจ
   - ห้าม Auto-sign และห้ามสรุปว่าเป็นไปตามกฎหมาย 100% จนกว่าจะผ่านที่ปรึกษากฎหมาย/บัญชีจริง

8. **Component H — Pre-order System Verification & Docs Drift Reconciliation:**
   - ตรวจสอบ Schema ตาราง `preorder_rounds` และ `preorder_items` เทียบกับ RLS และ Server Actions
   - ปรับปรุง `parseFacebookComment` ใน `src/lib/delivery-parser.ts` ใช้วิธีหาลำดับคำสังเกตก่อนหลัง (`earliestIdx`) ทำให้การแยกชื่อ, สินค้า, และจุดสังเกตแม่นยำยิ่งขึ้น
   - ตรวจสอบขั้นตอนการแปลงรอบพรีออเดอร์เป็นเที่ยวส่ง (`convertPreorderRoundToTripAction`)
   - บันทึกรายงานวิเคราะห์ข้อแตกต่าง (Docs Drift) ลงใน `docs/preorder-verification-report.md`
   - ชุดทดสอบ Unit Test: `test/delivery.test.ts` (10/10 PASS)

---

## 🛡️ 3. สถานะการตรวจสอบคุณภาพ (Quality Gates)

| การทดสอบ | คำสั่ง | สถานะ | หมายเหตุ |
| :--- | :--- | :---: | :--- |
| **Unit Tests** | `npm run test:unit` | 🟢 PASS | 169/169 tests ผ่านทั้งหมด (100%) รวม 15 Test Suites |
| **Smoke Tests** | `npm run test:smoke` | 🟢 PASS | 4/4 suites ผ่านทั้งหมด (Encryption, Thai Errors, Zod Validation, PromptPay) |
| **Integration & Smoke** | `npm test` | 🟢 PASS | รันทั้ง 169 unit tests + 4 smoke tests ผ่านครบถ้วน |
| **Next.js Production Build** | `npm run build` | 🟢 PASS | ผ่านครบ 35/35 routes ไม่มี Error (รวม /rider, /rider/login, /admin/riders) |
| **TypeScript Strict** | `npx tsc --noEmit` | 🟢 PASS | 0 Errors |

---

## 🔑 4. การจัดการกุญแจและความลับ (Credentials & Keys)

1. **SlipOK API Key**:
   - สามารถกรอกผ่านหน้าบ้านได้ที่: **`/admin/settings`** หมวด "ระบบตรวจสลิปอัตโนมัติ"
   - Key จะถูกเข้ารหัส AES-256-GCM อัตโนมัติด้วย `CREDENTIALS_ENCRYPTION_KEY` ใน `.env.local`
2. **SlipOK Webhook**:
   - Endpoint: `POST /api/webhooks/slipok`
   - Secret Header: ตรวจสอบผ่านตัวแปร `SLIPOK_WEBHOOK_SECRET` ใน [`.env.local`](file:///d:/system%20make/Ran-R-HAN/.env.local)
3. **Data Retention Cron Secret**:
   - Endpoint: `GET/POST /api/cron/data-retention`
   - Authorization: `Bearer <CRON_SECRET>`
4. **Dispatch Timeout Cron Secret**:
   - Endpoint: `GET/POST /api/cron/dispatch-timeout`
   - Authorization: `Bearer <CRON_SECRET>`
5. **Telegram Bot API**:
   - Config: `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_BOT_USERNAME` ใน [`.env.local`](file:///d:/system%20make/Ran-R-HAN/.env.local)
   - Status: บอท `@ranrhan_bot` ออนไลน์สมบูรณ์ พร้อมส่งข้อความ Offer งานใหม่และข้อความสถานะออเดอร์

---

## 🚀 5. ขั้นตอนสำหรับเริ่ม Closed Pilot (Pilot Go-Live Checklist)

1. **ตั้งพิกัดร้านค้าจริง:** ผู้ดูแลร้านเข้าสู่ระบบที่ `/admin/settings` แล้วกดปุ่ม "ดึงพิกัดปัจจุบัน" เพื่อบันทึก `shop_lat` และ `shop_lng`
2. **สร้างบัญชีไรเดอร์ 2-3 บัญชี:** เข้าสู่หน้า `/admin/riders` แล้วกด "เพิ่มไรเดอร์ใหม่" เพื่อสร้างบัญชีและรหัสผ่านสำหรับไรเดอร์ทดสอบ
3. **ลงทะเบียนรับงานไรเดอร์:** ให้ไรเดอร์ทดสอบเข้าสู่ระบบที่ `/rider/login` จากมือถือ และกดเปิดใช้งาน Web Push Notification
4. **เปิดใช้งาน Cron Job ภายนอก:** ตั้งค่าที่ cron-job.org ให้ยิงมาที่ `https://ran-r-han.vercel.app/api/cron/dispatch-timeout` ทุกๆ 1-2 นาที พร้อม Header `Authorization: Bearer <CRON_SECRET>`
5. **การตัดสินใจทางธุรกิจ/กฎหมายก่อนเปิดกว้าง (Legal/Financial Gate):** ตรวจสอบและลงนามในเอกสารสัญญา Rider Agreement, ตรวจสอบสถานะการจ้างงาน, และกำหนดโครงสร้างการจัดการ Rider Pool ตามที่ระบุไว้ใน `docs/legal-financial-drafts.md`

---

## 🚦 6. Pilot Readiness Verification Matrix

| Gate | รายการตรวจสอบ | สถานะจริง | หมายเหตุ / ขั้นตอนถัดไป |
| :--- | :--- | :--- | :--- |
| **Gate 1** | Production Migration `20260912000004` | **PASS** | คอลัมน์ `push_enabled`, `telegram_chat_id` และ Index ถูก apply บน Supabase Production เรียบร้อย |
| **Gate 2** | พิกัดร้าน Pilot "ครัวป้าแดง" | **PASS** | บันทึกผ่าน `updateShopGeoAction` เรียบร้อย (`19.3005, 97.9678`) |
| **Gate 3** | บัญชี Pilot Rider (2 บัญชี) | **PASS** | `rider1.kruapa@gmail.com` และ `rider2.kruapa@gmail.com` ทดสอบ Auth, Work Session และ PDPA purge ผ่าน |
| **Gate 4** | External Scheduler `/api/cron/dispatch-timeout` | **CONFIGURED IN CODE / NOT YET VERIFIED IN DEPLOYED PRODUCTION** | Endpoint ป้องกันด้วย `CRON_SECRET` และตั้งค่าใน `vercel.json` แล้ว — หลัง push/deploy ต้องตรวจ cron invocation จริงจาก deployment/log |
| **Gate 5** | Live Notification & Dispatch E2E | **PASS** | ทดสอบ Full Flow บน Production DB ผ่าน PostGIS, Offer, Graceful Notification Fallback และ Atomic Accept ผ่าน |
| **Gate 6** | Physical Device E2E (Android + iOS PWA) | **PHYSICAL DEVICE E2E: NOT YET VERIFIED** | ห้ามถือว่าผ่านจนกว่าจะทดสอบบนฮาร์ดแวร์ Android และ iPhone จริงในพื้นที่ อ.เมือง แม่ฮ่องสอน (Background GPS / Web Push vibration) |
| **Gate 7** | Quality Gates (Unit/Smoke/Typecheck/Build) | **ALL PASS** | Unit: 171/171 PASS, Smoke: 4/4 PASS, TSC: 0 errors, Build: 35/35 routes success |
| **Gate 8** | Git Branch & PR Organization | **READY** | แบ่งเป็น 4 คอมมิตแบบ atomic บน `feat/rider-system-phase1` โดยไม่แตะต้อง main |
