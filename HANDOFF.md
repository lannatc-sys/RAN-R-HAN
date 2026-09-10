# 🤝 Project Handoff & Status Log (RAN-R-HAN)

> **บันทึกสถานะการส่งมอบงาน (Handoff Document)**  
> **วันเวลาที่อัปเดตล่าสุด:** 2026-09-11 (GMT+7) — Rider P0 hardening
> **สถานะภาพรวม:** 🟡 Quality Gate ผ่าน; Rider P0 แก้แล้ว แต่ยังไม่ Production Ready จนกว่าจะปิด P1 และ Legal/Financial Gates ใน §17
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

---

## 🛡️ 3. สถานะการตรวจสอบคุณภาพ (Quality Gates)

| การทดสอบ | คำสั่ง | สถานะ | หมายเหตุ |
| :--- | :--- | :---: | :--- |
| **Unit Tests** | `pnpm run test:unit` | 🟢 PASS | 117/117 tests ผ่านทั้งหมด รวม Rider P0 security regression tests 6 รายการ |
| **Integration & Smoke** | `pnpm test` | 🟢 PASS | ครอบคลุม Auth, Orders, Payment, KDS, Delivery, Legal, Telegram & Rider |
| **Next.js Production Build** | `pnpm build` | 🟢 PASS | ผ่านครบ 35/35 routes ไม่มี Error (รวม /rider และ /rider/login) |
| **TypeScript Strict** | `npx tsc --noEmit` | 🟢 PASS | ไม่มี Error |

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
4. **Telegram Bot API**:
   - Config: `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_BOT_USERNAME` ใน [`.env.local`](file:///d:/system%20make/Ran-R-HAN/.env.local)
   - Status: บอท `@ranrhan_bot` ออนไลน์สมบูรณ์ Webhook ชี้ไปที่ `https://ran-r-han.vercel.app/api/telegram/webhook` และตั้งค่าคำอธิบายภาษาไทยเรียบร้อย

---

## 🚀 5. สิ่งที่สามารถทำต่อได้ในรอบถัดไป (Next Steps)

1. **ตั้งพิกัดร้านในระบบ:** กรอก `shops.shop_lat` / `shops.shop_lng` ของร้านที่เปิดใช้ระบบจัดส่ง — ถ้าไม่มีพิกัดร้าน ระบบจะ fallback ไปใช้พิกัดลูกค้าเป็นจุดค้นหาไรเดอร์ (แม่นน้อยกว่า)
2. **สร้างบัญชีไรเดอร์จริง:** เพิ่มไรเดอร์ที่ `/admin/riders` แล้วผูก `auth_user_id` กับบัญชี Supabase Auth เพื่อให้ล็อกอินที่ `/rider` ได้
3. **แจ้งเตือน Offer ถึงไรเดอร์:** ตอนนี้หน้า `/rider` ใช้การ Poll ทุก 5 วินาที — ขั้นถัดไปควรต่อ Web Push หรือ Telegram Bot ให้ไรเดอร์ (ฟังก์ชัน `notifyRiderViaTelegram` ใน `src/app/actions/dispatch.ts` ยังเป็น stub เขียน log อย่างเดียว)
4. **ตั้ง Scheduler ให้ `/api/cron/dispatch-timeout`:** ปัจจุบันระบบเก็บกวาด Offer หมดเวลาตอนเริ่ม dispatch รอบใหม่อยู่แล้ว ถ้าต้องการให้ไวขึ้นให้ตั้งตัวจับเวลาภายนอก (เช่น cron-job.org ฟรี) ยิงทุก 1 นาทีพร้อม Header `Authorization: Bearer <CRON_SECRET>`
5. **ทดสอบ Web Push บนมือถือจริง:** ทดสอบเปิดรับแจ้งเตือนสำหรับพนักงาน/ห้องครัว (iOS Safari PWA + Android)
6. **ระบบสลิปบน Production:** นำ SlipOK Webhook URL และ Secret ไปใส่ใน SlipOK Dashboard ของร้านป้าแดง
7. **Blocker ก่อน Production ของระบบไรเดอร์ (§17):** โครงสร้างกองกลาง Rider Pool, สัญญา Rider Agreement, ผู้ดูแลบัญชีกลาง และเรื่องภาษี ยังต้องให้ผู้เชี่ยวชาญตรวจก่อนเปิดใช้จริง
