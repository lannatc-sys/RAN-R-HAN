# TODO — Rab-R-Han: ระบบสั่งอาหารออนไลน์ + รับหน้าร้าน (MVP รอบทดลอง 1 ร้าน)

> ไฟล์นี้เขียนไว้ให้ AI/นักพัฒนาอีกคน (เช่น Gemini) หยิบไปทำต่อได้โดยไม่ต้องคุยย้อนหลัง
> ทุกการตัดสินใจที่ทำไปแล้วเขียนไว้พร้อมเหตุผล ถ้าจะเปลี่ยนแนวคิดที่ตัดสินใจไว้แล้ว ให้กลับมาคุยกับผู้ใช้ก่อน อย่าเปลี่ยนเอง

## 1. เป้าหมายจริงของรอบนี้ (อ่านก่อนเริ่ม)

ระบบนี้**เคยถูกออกแบบให้ใหญ่เกินจำเป็น** (มี dine-in/QR โต๊ะ, ปิดกะเงินสด, Super Admin, billing ฯลฯ) แต่เป้าหมายจริงของรอบทดลองนี้คือแค่:

- ร้านอาหารเล็ก **1 ร้าน** ใช้งานจริงก่อน (ไม่ใช่ multi-tenant เต็มรูปแบบ แต่ schema ออกแบบให้รองรับหลายร้านได้ในอนาคตโดยไม่ต้องแก้โครงสร้าง)
- ลูกค้า **สั่งอาหารออนไลน์แล้วมารับที่หน้าร้าน** เท่านั้น — **ไม่มี dine-in / ไม่มีโต๊ะ / ไม่มี QR ต่อโต๊ะ**
- พนักงาน/เจ้าของร้านก็ **สั่งแทนลูกค้าหน้าร้านได้** ด้วยเมนูเดียวกัน (walk-in)
- ร้านนี้**ไม่มีเครื่องปริ้น** — ห้ามออกแบบ flow ที่บังคับต้องพิมพ์อะไร
- เจ้าของร้าน + พนักงาน **คนละเครื่อง คนละมือถือ** (มีทั้ง Android และ iPhone ปนกัน)
- จ่ายเงิน 2 แบบ: **โอน PromptPay ล่วงหน้า (ตรวจสลิปอัตโนมัติ)** หรือ **จ่ายเงินสดตอนมารับที่ร้าน**
- แจ้งเตือนออเดอร์ใหม่ให้ร้าน: **ห้ามใช้ LINE Notify/LINE OA** (มีค่าใช้จ่ายแฝง) → ใช้ **Web Push (ฟรี)** แทน
- **ไม่ต้องมี**: ระบบปิดกะ/เงินสด (cash shift, Z-report), ระบบ option 2 ชั้น (option groups), audit log, Super Admin console, ระบบ subscription/billing ของแพลตฟอร์มเอง

ถ้าเจอโค้ด/ไฟล์เก่าในโปรเจกต์ที่พูดถึงเรื่องที่ตัดออกไปแล้วข้างบน (เช่น `tables`, `cash_shifts`, option groups) **ไม่ต้องลบทิ้ง** แต่ก็ไม่ต้องเอามาใช้ในรอบนี้ — ปล่อยไว้เฉยๆ เผื่ออนาคต

## 2. สถานะปัจจุบันของโปรเจกต์ (ก่อนเริ่มงาน)

โฟลเดอร์ `D:\system make\Rab-R-HAN` ตอนนี้มี:

- `supabase/migrations/20260904000001_initial_schema.sql` — schema จริงที่ใช้อยู่ (ตาราง: `shops`, `users`, `categories`, `menu_items`, `options`, `tables`, `orders`, `order_items`, `payments`)
- `supabase/migrations/20260904000002_rls_policies.sql` — RLS policies ของตารางข้างบน (มี helper function: `has_shop_access()`, `is_shop_owner()`, `is_superadmin()`, `current_user_shop_id()`)
- `supabase/schema.sql` — ไฟล์ schema ฉบับร่างเก่า (ดูเหมือนซ้ำ/ล้าสมัยกว่า migrations ด้านบน ให้ยึด migrations เป็นหลัก)
- `seed.sql` — ข้อมูลตัวอย่าง
- `stitch_thai_pos/` — ดีไซน์หน้าจอ (Stitch-generated HTML mockups) หลายหน้า รวมถึงหน้าที่ **ไม่ต้องใช้ในรอบนี้** เช่น cash shift, super admin, subscription billing — ใช้เป็น reference ด้าน UI ได้ แต่**อย่า implement ทุกหน้า**
- `package.json` — **ว่างเปล่า** ยังไม่มีการตั้งค่าโปรเจกต์ใดๆ
- **ยังไม่มีโฟลเดอร์ `src/`** — แปลว่ายังไม่มีแอปจริง มีแค่ schema + mockup

**สิ่งสำคัญ**: มีการตรวจสอบ (review) เนื้อหาที่เคยถูกออกแบบไว้ในแชทก่อนหน้า และพบว่า schema/RPC ที่เคยเสนอไว้ **ใช้ชื่อตาราง/คอลัมน์ที่ไม่ตรงกับของจริงในโปรเจกต์นี้** (เช่น เสนอ `profiles` แต่ของจริงคือ `users`, เสนอ `shop_tables` แต่ของจริงคือ `tables`, เสนอ option 2 ชั้นแต่ของจริงมี `options` ตารางเดียว) — **ห้ามก็อปโค้ด SQL/TypeScript จากแชทเก่ามาใช้ตรงๆ** ต้องปรับให้ตรงกับ schema จริงด้านบนก่อนเสมอ

## 3. Schema ที่ต้องแก้ (ต่อยอดของเดิม ไม่ใช่เขียนใหม่ทั้งหมด)

สร้าง migration ใหม่ (เช่น `20260906000001_pickup_mvp.sql`) เพิ่มเติมจากของเดิม โดย **ห้ามแก้ไฟล์ migration เก่าที่มีอยู่แล้ว** ให้เพิ่มไฟล์ใหม่แทน:

- [x] เพิ่มคอลัมน์ `orders.source` — `text not null default 'customer' check (source in ('customer','staff'))` — บอกว่าออเดอร์นี้ลูกค้าสั่งเองออนไลน์ หรือพนักงานกดแทนหน้าร้าน
- [x] เพิ่มคอลัมน์ให้ `shops`:
  - `has_printer boolean not null default false`
  - `device_mode text not null default 'multi_device' check (device_mode in ('single_device','multi_device'))`
  - (ร้านทดลองนี้ตั้งค่าเป็น `has_printer = false`, `device_mode = 'multi_device'`)
- [x] เพิ่มคอลัมน์ `payments.trans_ref text` + `unique index` กันสลิปซ้ำ (`create unique index if not exists payments_trans_ref_uq on public.payments (trans_ref) where trans_ref is not null;`)
- [x] สร้างตารางใหม่ `shop_payment_credentials` เก็บ API key ของบริการตรวจสลิป (SlipOK/OkSlip) **แบบเข้ารหัส** — แต่ละร้านเอา API key ของตัวเองมาใส่เอง
- [x] สร้างตารางใหม่ `payment_slips` เก็บ raw payload จาก SlipOK สำหรับ debug/ตรวจย้อนหลัง
- [x] สร้างตารางใหม่ `push_subscriptions` เก็บ Web Push subscription ของแต่ละเครื่อง/แต่ละ user
- [x] **ไม่ต้อง** rename enum `order_status`/`order_type` ใดๆ — ใช้ค่าเดิมที่มีอยู่:
  - ใช้ `orders.type = 'takeaway'` แทนการสั่งแบบรับที่ร้าน
  - สถานะ `orders.status = 'served'` ให้แปลความหมายเป็น **"พร้อมรับที่ร้าน"** ตอนแสดงผลใน UI
- [x] เพิ่ม RPC `create_pickup_order(...)` สำหรับสร้างออเดอร์แบบปลอดภัย
- [x] เพิ่ม RPC `verify_and_confirm_payment(...)` สำหรับ webhook เรียกตอนสลิปผ่าน

## 4. Backend / API ที่ต้องทำ

- [x] Bootstrap โปรเจกต์ Next.js (App Router) + Supabase client (`@supabase/ssr`) + Tailwind CSS v4
- [x] Route/Server Action สั่งอาหาร: รับ input จาก Zod schema, เรียก RPC `create_pickup_order`, แปล error code เป็นข้อความไทย (ดูข้อ 6)
- [x] สร้าง PromptPay QR ใช้ npm package `promptpay-qr` + `qrcode` แทนการเขียน EMVCo/CRC16 payload เอง
- [x] Webhook รับสลิปจาก SlipOK/OkSlip (`/api/webhooks/slipok`):
  - ดึง API key ของร้านจาก `shop_payment_credentials` มาถอดรหัสฝั่ง server
  - ตรวจ secret header
  - ตรวจบัญชีปลายทางแบบ exact match
  - เรียก RPC `verify_and_confirm_payment`
  - จับ error กรณีสลิปซ้ำด้วย `error.code === '23505'`
- [x] Web Push:
  - Generate VAPID keys, เก็บใน env vars
  - Service worker สำหรับรับ push event (`public/sw.js`)
  - Endpoint ให้ client subscribe (`POST /api/push/subscribe`) → upsert ลง `push_subscriptions`
  - ตอนมีออเดอร์ใหม่ → ส่ง push ไปหา staff ทุกคนในร้าน

## 5. Frontend ที่ต้องทำ

### หน้าลูกค้า (public, ไม่ต้อง login)
- [x] หน้าเมนู: แสดง `categories` → `menu_items` → `options` (ร้านที่ `is_active = true` เท่านั้น)
- [x] ตะกร้า + checkout: เลือกจ่ายออนไลน์ (แสดง PromptPay QR แบบ dynamic ใส่ยอดเงิน) หรือเลือก "จ่ายเงินสดตอนมารับ"
- [x] หน้าติดตามสถานะออเดอร์ (แสดง pending/confirmed/cooking/served/completed แบบ real-time — ใช้ label ภาษาไทยที่แปลแล้ว)

### หน้าร้าน (ต้อง login เป็น owner/staff)
- [x] หน้า "สั่งแทนลูกค้า" (walk-in) — ใช้เมนูหน้าเดียวกับลูกค้า แต่ tag `orders.source = 'staff'`
- [x] หน้าคิวออเดอร์ (KDS): Realtime subscribe + push notification — ปุ่มเปลี่ยนสถานะ pending → confirmed/cooking → served (พร้อมรับ) → completed พร้อมปุ่ม "ยืนยันรับเงินสดแล้ว"
- [x] หน้าจัดการเมนู (categories/menu_items/options) — CRUD ง่ายๆ ปิด/เปิดสถานะพร้อมขาย
- [x] หน้าตั้งค่าร้าน: ข้อมูลพร้อมเพย์ และฟอร์มกรอก SlipOK API Key แบบเข้ารหัส (write-only)
- [x] ปุ่ม subscribe push notification — เช็ค platform: ถ้า iOS และยังไม่ได้ติดตั้งเป็น Home Screen app ให้โชว์คำแนะนำ "เพิ่มลงหน้าจอโฮมก่อน"

## 6. Error handling ที่ต้องระวัง

- [x] Error code match แบบ case-sensitive ตรงกัน (`ORDER_LOCKED`, `EMPTY_CART`, `SHOP_NOT_FOUND`, ฯลฯ)
- [x] เช็คสลิปซ้ำใช้ `error.code === '23505'`
- [x] RPC ดึงราคาจาก `price_snapshot`/`name_snapshot` ไม่แตะบิลเก่า

## 7. Testing

- [x] Smoke test: AES-256-GCM encryption & decryption
- [x] Smoke test: Thai error formatter (case-sensitive & 23505)
- [x] Smoke test: Zod order validation schema
- [x] Smoke test: Dynamic PromptPay QR generator
- [x] Production Build Test (`pnpm build`): ผ่าน 100% ครบทุก 11 dynamic/static routes

## 6. Error handling ที่ต้องระวัง (บั๊กที่เคยเจอจาก draft เก่า ห้ามพลาดซ้ำ)

- [ ] **Error code ต้อง match แบบ case-sensitive ให้ตรงกัน** — ถ้า SQL trigger raise `'ORDER_LOCKED: ...'` (ตัวพิมพ์ใหญ่) ฝั่ง TypeScript ก็ต้อง `.includes('ORDER_LOCKED')` ให้ตรงตัวพิมพ์ ห้ามฝั่งหนึ่งพิมพ์เล็กอีกฝั่งพิมพ์ใหญ่เหมือน draft เก่าที่ทำให้ error message ไทยไม่ขึ้นเลย
- [ ] เช็คสลิปซ้ำใช้ `error.code === '23505'` ไม่ใช่ string match ข้อความ error (ข้อความ Postgres เปลี่ยนได้ตาม locale/version)
- [ ] ทุก RPC ที่แก้เงิน/สถานะสำคัญต้องมี test ยืนยันว่าถ้าแก้ราคาเมนูทีหลัง **บิลเก่าต้องไม่เปลี่ยน** (เพราะ `order_items` เก็บ `price_snapshot`/`name_snapshot` อยู่แล้วในของเดิม — แค่ห้ามลืมตอนเขียน RPC ใหม่)

## 7. Testing ที่ต้องทำก่อนถือว่าเสร็จ

- [ ] Smoke test: เปิดเมนู → สั่งออนไลน์ → จ่าย PromptPay (mock slip) → ออเดอร์เปลี่ยนเป็น confirmed อัตโนมัติ
- [ ] Smoke test: สั่งแบบจ่ายเงินสด → พนักงานกด "รับเงินสดแล้ว" ที่หน้าคิวออเดอร์ → payment เปลี่ยนเป็น verified
- [ ] Smoke test: ร้านแก้ราคาเมนูหลังมีออเดอร์ค้างอยู่ → เปิดออเดอร์เก่าดู ราคาต้องไม่เปลี่ยน
- [ ] ทดสอบ push notification บนอุปกรณ์จริงทั้ง Android และ iPhone (ต้องเทสจริง จำลองไม่ได้)
- [ ] ทดสอบสลิปซ้ำ (ยิง trans_ref เดิมซ้ำ) ต้องถูกปฏิเสธ

## 8. สิ่งที่ตั้งใจ "ยังไม่ทำ" ในรอบนี้ (กันสับสน)

- ระบบปิดกะ/นับเงินสด (cash shift, X/Z-reading)
- Option 2 ชั้น (option groups + options แยกกลุ่ม)
- Audit log / Super Admin console / ระบบ subscription-billing ของแพลตฟอร์ม
- Dine-in / โต๊ะ / QR ต่อโต๊ะ
- LINE Notify หรือ LINE OA ในทุกจุด

## 9. เทียบกับ Blueprint ฉบับเต็ม (วิสัยทัศน์ระยะยาวของแพลตฟอร์ม)

มี blueprint อีกฉบับที่ออกแบบระบบเต็มรูปแบบไว้ (multi-tenant เต็มรูป, dine-in QR ต่อโต๊ะ, Superadmin/impersonate,
รายงานรายได้ครบชุด) — เทียบแล้วสรุปได้ว่า:

**ทำตอนนี้ (สอดคล้องกับ MVP รอบนี้อยู่แล้ว):**
- Shared-DB multi-tenant ผ่าน `shop_id` — ตรงกับ schema ที่มีอยู่แล้ว ใช้ต่อได้เลย
- Next.js (App Router) + Supabase + Vercel — ตรงกับแผน bootstrap ในข้อ 4
- ลิงก์สั่งล่วงหน้าแบบไม่มี `?table=` (กรอกเบอร์ + เลือกเวลารับ) — **คือ flow หลักของรอบนี้เลย** ให้ทำ path นี้ก่อน ไม่ใช่ path ที่ต้องสแกน QR โต๊ะ
- ใช้ npm package `promptpay-qr` (ดูข้อ 4 ด้านบน) แทนเขียน EMVCo payload เอง

**ทำทีหลัง (phase 2 หลังร้านทดลองรอบนี้ผ่านแล้ว):**
- Dine-in / QR ต่อโต๊ะ / พิมพ์ QR ทุกโต๊ะเป็น PDF — ยังไม่ต้องทำ ตามข้อ 1
- รายงานรายได้แบบครบชุด (แยกวัน/สัปดาห์/เดือน, Top 10 เมนู, ช่วงเวลาขายดี, Export CSV) — มีประโยชน์แต่ไม่จำเป็นต่อการรันร้านทดลอง ถ้าจะทำอะไรสักอย่างตอนนี้ทำแค่ "ยอดขายวันนี้" ตัวเลขเดียวพอ

**ข้ามไปเลยสำหรับรอบทดลองนี้:**
- **Superadmin / `/root` / impersonate + audit log** — มีประโยชน์ตอนปล่อยเช่าหลายร้าน แต่รอบนี้มีร้านเดียวและเจ้าของระบบคือคนคุมเองอยู่แล้ว ไม่มีอะไรให้ "แอดมิน" จัดการ ทำตอนนี้คือ over-scope
- **RLS แบบ `auth.jwt() -> 'shop_id'`** — RLS ที่มีอยู่แล้วใช้วิธี `has_shop_access()` เช็คตาราง `users` ซึ่งทำงานได้ดีอยู่แล้ว ไม่ต้องรื้อมาทำใหม่ตาม blueprint นี้ ไม่มีประโยชน์เพิ่ม มีแต่เสียเวลา
- Tiered slip-verification (เริ่มจากให้เจ้าของกดยืนยันเอง แล้วค่อยขาย SlipOK เป็น add-on) — **ตัดสินใจไปแล้ว**ว่าจะใช้ SlipOK/OkSlip อัตโนมัติตั้งแต่วันแรก และ**แต่ละร้านนำ API key ของตัวเองมาใส่เอง** (เก็บแบบเข้ารหัส ดูข้อ 3) — แปลว่าแพลตฟอร์มไม่ต้องแบกต้นทุนค่าตรวจสลิปของร้านไหนเลย ยิ่งเหมาะกับตอนขยายไปหลายร้านในอนาคต ไม่ต้อง downgrade เป็น manual

## 10. สิ่งที่ต้องทำเพิ่ม: ระบบความปลอดภัยหน้า KDS (PIN 4 หลัก)
- [x] Database: อัปเดตไฟล์ migration `20260906000001_pickup_mvp.sql` เพิ่มคอลัมน์ `kds_pin text default '0000'` ลงในตาราง `shops` (เสร็จแล้ว และรัน migration ลง Supabase DB เรียบร้อย)
- [x] UI: สร้าง Component แป้นพิมพ์ตัวเลข (Numpad) 4 หลัก (`src/components/admin/PinModal.tsx` รองรับทั้งปุ่มตัวเลขบนหน้าจอสัมผัส และคีย์บอร์ด พร้อม animation)
- [x] KDS Logic: ผูกเงื่อนไขให้แสดง Numpad เมื่อพนักงานกดปุ่ม "ยกเลิกออเดอร์" (ป้องกันมือลั่น ใน `OrdersKDSClient.tsx`)
- [x] Admin Logic: ผูกเงื่อนไขบังคับใส่ PIN ก่อนกดเข้าหน้า "ตั้งค่าร้าน" และ "รายงานยอดขาย" (ป้องกันพนักงานทั่วไปเข้าถึง ใน `SettingsClient.tsx` พร้อมระบบเปลี่ยน PIN และดูสรุปยอดขายวันนี้)

## 6. Error handling ที่ต้องระวัง (สิ่งที่ยังต้องทำต่อ)
- [x] Frontend/Server Action: ตรวจสอบโค้ดให้ดักจับ Error จาก RPC แบบ Case-sensitive (เช่น `.includes('ORDER_LOCKED')`) ตัวพิมพ์ใหญ่-เล็กต้องเป๊ะ เพื่อให้แสดงข้อความภาษาไทยได้ถูกต้อง (`src/lib/thai-errors.ts`)
- [x] Webhook SlipOK: ดักจับ Error รหัส `23505` (Unique Violation ของ `trans_ref`) แทนการเช็ค string ข้อความ เพื่อป้องกันสลิปซ้ำให้รัดกุมที่สุด (`src/app/api/webhooks/slipok/route.ts`)
- [x] RPC Review: เช็ค RPC `create_pickup_order` และอื่นๆ ให้ชัวร์ว่าบันทึกค่าลง `price_snapshot` และ `name_snapshot` ขาดตัว ห้ามมีบรรทัดไหนอ้างอิงกลับไปหาตาราง `menu_items` อีกหลังบิลถูกสร้างแล้ว (ทดสอบยืนยันใน `test/e2e-test.ts`)

## 11. ระบบ Superadmin และความเป็นส่วนตัวขั้นสูงสุด (Privacy First & Consent-based Support Access)
- [x] Superadmin Authentication: รองรับ `SUPER_ADMIN_USER` ใน `.env.local` กำหนดสิทธิ์อัตโนมัติ และป้องกันผู้ใช้ทั่วไปเข้าถึง `/superadmin`
- [x] Superadmin Overview & Stores Management: จัดการร้านค้าทั้งหมด (Active, Suspended, Expired), เปลี่ยน Plan, ปรับแต่ง Slug, สวมรอยเข้าร้าน (Impersonate)
- [x] Privacy First สำหรับ Superadmin: ตัดการแสดงผลยอดขาย (GMV) และรายได้ของร้านค้าออกจากหน้า Overview และ All Stores Directory อย่างถาวร เหลือเฉพาะ "ออเดอร์สะสม" เพื่อมอนิเตอร์ภาระโหลดระบบโดยไม่ก้าวล่วงข้อมูลทางการเงิน
- [x] Consent-based Support Access: เพิ่มฟิลด์ `support_access_expires_at` ในตาราง `shops` บน Supabase DB
- [x] Store Consent Controls: เพิ่มการ์ดจัดการสิทธิ์ในหน้าตั้งค่าร้านค้า (`SettingsClient.tsx`) ให้ร้านกดยินยอมให้ทีมงานเข้าถึงข้อมูลชั่วคราว (24 หรือ 48 ชม.) พร้อมปุ่มยกเลิกสิทธิ์ทันที
- [x] Superadmin Privacy Mode & Censorship: ตรวจสอบเวลาหมดอายุเมื่อ Superadmin กด Impersonate หากไม่มีสิทธิ์หรือหมดอายุ จะเซ็นเซอร์ยอดเงินทั้งหมดเป็น `*** ฿` ทั้งหน้า KDS และ Settings พร้อมแถบแจ้งเตือน Privacy Mode
- [x] Verification: ชุดทดสอบครอบคลุมทั้ง `test/privacy-consent-test.ts`, `test/superadmin-test.ts`, `test/e2e-test.ts` และ `test/smoke-test.ts` ผ่าน 100% ครบทุกข้อ

## 12. สิ่งที่ต้องทำเพิ่ม: ระบบร้านจัดส่งเอง (Store Delivery)
- [x] Database: อัปเดต migration เพิ่ม `customer_name`, `delivery_address`, `delivery_lat`, `delivery_lng` ในตาราง `orders` (รันลงฐานข้อมูล Supabase เรียบร้อย)
- [x] Frontend (Customer): เพิ่มปุ่มเลือกประเภทออเดอร์ (Pick-up / Delivery) ในหน้าตะกร้าสินค้า
- [x] Frontend (Customer): สร้างฟอร์มกรอกข้อมูลจัดส่ง (ชื่อ, เบอร์, ที่อยู่)
- [x] Frontend (Customer): ทำปุ่ม "Get GPS" โดยใช้ `navigator.geolocation` ดึงพิกัด Lat/Lng พร้อม feedback และลิงก์แสดงผล
- [x] Frontend (KDS): ปรับ UI การ์ดออเดอร์ให้แสดงที่อยู่จัดส่ง, ชื่อผู้รับ, เบอร์โทร และปุ่ม "เปิดแผนที่ Google Maps" นำทางได้ทันที
- [x] Frontend (Order Tracking): ปรับหน้าติดตามออเดอร์ของลูกค้าให้แสดงสถานะ "พร้อมจัดส่ง" และข้อมูลที่อยู่จัดส่งแบบเรียลไทม์