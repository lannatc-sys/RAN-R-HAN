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

- [ ] เพิ่มคอลัมน์ `orders.source` — `text not null default 'customer' check (source in ('customer','staff'))` — บอกว่าออเดอร์นี้ลูกค้าสั่งเองออนไลน์ หรือพนักงานกดแทนหน้าร้าน
- [ ] เพิ่มคอลัมน์ให้ `shops`:
  - `has_printer boolean not null default false`
  - `device_mode text not null default 'multi_device' check (device_mode in ('single_device','multi_device'))`
  - (ร้านทดลองนี้ตั้งค่าเป็น `has_printer = false`, `device_mode = 'multi_device'`)
- [ ] เพิ่มคอลัมน์ `payments.trans_ref text` + `unique index` กันสลิปซ้ำ (`create unique index if not exists payments_trans_ref_uq on public.payments (trans_ref) where trans_ref is not null;`)
- [ ] สร้างตารางใหม่ `shop_payment_credentials` เก็บ API key ของบริการตรวจสลิป (SlipOK/OkSlip) **แบบเข้ารหัส** — แต่ละร้านเอา API key ของตัวเองมาใส่เอง (ไม่ใช้ key กลางของแพลตฟอร์ม เพราะร้านมีหลายเจ้าในอนาคต ไม่อยากแบกต้นทุนค่าตรวจสลิปของทุกร้านเอง):
  ```sql
  create table if not exists public.shop_payment_credentials (
      shop_id uuid primary key references public.shops(id) on delete cascade,
      slip_check_provider text not null default 'slipok', -- เผื่อรองรับ provider อื่นในอนาคต
      api_key_encrypted bytea not null,
      updated_at timestamptz not null default timezone('utc'::text, now())
  );
  alter table public.shop_payment_credentials enable row level security;
  -- ห้าม select ตรงๆ จาก client ทุกกรณี (แม้แต่ owner ร้านตัวเอง) — อ่าน/ถอดรหัสได้เฉพาะฝั่ง server
  -- (service role / server action) เท่านั้น ไม่มี select policy ให้ authenticated role เลย
  ```
  **หลักการสำคัญ (ปิดข้อมูลไว้ตามที่ผู้ใช้ระบุ):**
  - เข้ารหัส API key ด้วย Node.js (เช่น AES-256-GCM) โดยใช้ secret key จาก env var (`CREDENTIALS_ENCRYPTION_KEY`) ฝั่ง server เท่านั้น ห้ามเข้ารหัส/ถอดรหัสฝั่ง client เด็ดขาด
  - หน้า "ตั้งค่าร้าน" ให้กรอก API key ได้ (write-only) — บันทึกแล้ว **ไม่ต้องส่งค่ากลับมาแสดงอีก** ให้โชว์แค่สถานะ "ตั้งค่าแล้ว ✅" พร้อมปุ่ม "เปลี่ยน API key" (เขียนทับของเดิม ไม่ต้องดึงของเก่ามาโชว์)
  - ตอน webhook เรียก SlipOK/OkSlip หรือ verify signature ให้ดึง key มาถอดรหัสเฉพาะฝั่ง server (service role) ตอนใช้งานจริงเท่านั้น ห้าม log ค่า decrypted ออกมาใน console/error message
- [ ] สร้างตารางใหม่ `payment_slips` เก็บ raw payload จาก SlipOK สำหรับ debug/ตรวจย้อนหลัง:
  ```sql
  create table if not exists public.payment_slips (
      id uuid primary key default gen_random_uuid(),
      payment_id uuid not null references public.payments(id) on delete cascade,
      raw_payload jsonb not null,
      created_at timestamptz not null default timezone('utc'::text, now())
  );
  ```
- [ ] สร้างตารางใหม่ `push_subscriptions` เก็บ Web Push subscription ของแต่ละเครื่อง/แต่ละ user:
  ```sql
  create table if not exists public.push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      shop_id uuid not null references public.shops(id) on delete cascade,
      endpoint text not null unique,
      p256dh text not null,
      auth text not null,
      created_at timestamptz not null default timezone('utc'::text, now())
  );
  ```
  ต้องเปิด RLS + policy ให้ user เห็น/ลบได้เฉพาะของตัวเอง, staff คนอื่นในร้านเดียวกันห้ามเห็น endpoint ของกันและกัน
- [ ] **ไม่ต้อง** rename enum `order_status`/`order_type` ใดๆ — ใช้ค่าเดิมที่มีอยู่:
  - ใช้ `orders.type = 'takeaway'` แทนการสั่งแบบรับที่ร้าน (ไม่ใช้ `'dine_in'` เลยในรอบนี้)
  - สถานะ `orders.status = 'served'` ให้แปลความหมายเป็น **"พร้อมรับที่ร้าน"** ตอนแสดงผลใน UI (ไม่ใช่ dine-in "เสิร์ฟที่โต๊ะ") — แปลที่ชั้น UI เท่านั้น ไม่แตะ enum ในฐานข้อมูล
- [ ] เพิ่ม RPC `create_pickup_order(...)` สำหรับสร้างออเดอร์แบบปลอดภัย (ดึงราคาจาก `menu_items`/`options` ปัจจุบันมา snapshot ลง `order_items` เอง ห้ามให้ client ส่งราคามาตรงๆ) — เขียนใหม่ให้ตรงกับ schema จริง (ไม่ใช่ copy จาก transcript เก่า)
- [ ] เพิ่ม RPC `verify_and_confirm_payment(...)` สำหรับ webhook เรียกตอนสลิปผ่าน — set `payments.status = 'verified'`, `orders.status = 'confirmed'` แบบ atomic ใน transaction เดียว, กันสลิปซ้ำด้วย unique constraint (เช็คผ่าน error code `23505` ไม่ใช่ string match ข้อความ error)

## 4. Backend / API ที่ต้องทำ

- [ ] Bootstrap โปรเจกต์ (`package.json` ตอนนี้ว่างเปล่า) — แนะนำ Next.js (App Router) + Supabase client (`@supabase/ssr`) เพราะโค้ดตัวอย่างที่มีอยู่แล้วเขียนแนวนี้
- [ ] Route/Server Action สั่งอาหาร: รับ input จาก Zod schema, เรียก RPC `create_pickup_order`, แปล error code เป็นข้อความไทย (ดูข้อ 6)
- [ ] สร้าง PromptPay QR ใช้ npm package `promptpay-qr` + `qrcode` แทนการเขียน EMVCo/CRC16 payload เอง (มี draft เก่าเคยเขียนมือแล้วมีความเสี่ยงเรื่อง byte-format ผิด) —
  ```ts
  import generatePayload from 'promptpay-qr'
  import QRCode from 'qrcode'
  const payload = generatePayload(shop.promptpay_id, { amount: order.total })
  const qrDataUrl = await QRCode.toDataURL(payload)
  ```
- [ ] Webhook รับสลิปจาก SlipOK/OkSlip (`/api/webhooks/slipok`):
  - ระบุร้านจาก payload (`ref1`/`ref2` หรือคล้ายกัน) แล้วดึง API key **ของร้านนั้นๆ** จาก `shop_payment_credentials` มาถอดรหัสฝั่ง server เพื่อใช้ตรวจสอบ signature/เรียก API เพิ่มเติมถ้าจำเป็น (แต่ละร้านใช้ key ของตัวเอง ไม่ใช่ key กลาง — ดูข้อ 3)
  - ตรวจ secret header ก่อนเสมอ
  - ตรวจบัญชีปลายทางให้ตรงกับ `shops.promptpay_id`/`promptpay_name` แบบ **exact match** ของเลขบัญชีที่ normalize แล้ว (ห้ามใช้ `.includes()` แบบ substring เหมือน draft เก่าที่เคยรีวิวไว้ — มันหลวมเกินไป)
  - เรียก RPC `verify_and_confirm_payment`
  - จับ error กรณีสลิปซ้ำด้วย `error.code === '23505'`
- [ ] Web Push:
  - Generate VAPID keys, เก็บใน env vars
  - Service worker สำหรับรับ push event
  - Endpoint ให้ client subscribe (`POST /api/push/subscribe`) → insert ลง `push_subscriptions`
  - ตอนมีออเดอร์ใหม่ (insert เข้า `orders`) → ส่ง push ไปหา `push_subscriptions` ทุกแถวของร้านนั้น (ใช้ Supabase Realtime หรือ trigger ยิงเข้า queue/Edge Function ก็ได้ เลือกทางที่ deploy ง่ายที่สุด)

## 5. Frontend ที่ต้องทำ

### หน้าลูกค้า (public, ไม่ต้อง login)
- [ ] หน้าเมนู: แสดง `categories` → `menu_items` → `options` (ร้านที่ `is_active = true` เท่านั้น)
- [ ] ตะกร้า + checkout: เลือกจ่ายออนไลน์ (แสดง PromptPay QR แบบ dynamic ใส่ยอดเงิน) หรือเลือก "จ่ายเงินสดตอนมารับ"
- [ ] หน้าติดตามสถานะออเดอร์ (แสดง pending/confirmed/cooking/served/completed แบบ real-time — ใช้ label ภาษาไทยที่แปลแล้วตามข้อ 3)

### หน้าร้าน (ต้อง login เป็น owner/staff)
- [ ] หน้า "สั่งแทนลูกค้า" (walk-in) — ใช้เมนูหน้าเดียวกับลูกค้า แต่ tag `orders.source = 'staff'`
- [ ] หน้าคิวออเดอร์ (คล้าย KDS แต่ **ตัด Web Audio synth / polling fallback ที่ซับซ้อนออก** — ใช้แค่ Supabase Realtime subscribe ธรรมดา + push notification เป็นตัวเตือนหลัก) — ปุ่มเปลี่ยนสถานะ pending → confirmed/cooking → served (พร้อมรับ) → completed
- [ ] หน้าจัดการเมนู (categories/menu_items/options) — CRUD ง่ายๆ ไม่ต้องมี option-group 2 ชั้น
- [ ] ปุ่ม subscribe push notification — เช็ค `navigator.userAgent`/platform: ถ้า iOS และยังไม่ได้ติดตั้งเป็น Home Screen app ให้โชว์คำแนะนำ "เพิ่มลงหน้าจอโฮมก่อน" แทนปุ่มขอ permission ตรงๆ

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
