# RAN-R-HAN — Project Knowledge Document

> เอกสารนี้คือแหล่งความจริงหลัก (Single Source of Truth) ของโปรเจกต์
> อ่านก่อนทำงานทุกครั้ง ห้ามเดาหรือสร้างสิ่งที่ขัดแย้งกับเอกสารนี้

---

## 1. ภาพรวมโปรเจกต์ (Project Overview)

**ชื่อ:** RAN-R-HAN (รานร้าน)  
**ประเภท:** ระบบสั่งอาหารออนไลน์และจัดการร้านอาหาร Multi-tenant SaaS (PWA)  
**เป้าหมายเฟสนี้:** ทดลองกับร้านอาหาร 1 ร้าน ก่อนขยายสเกล

---

## 2. Tech Stack

| Layer | Technology | หมายเหตุ |
|:--|:--|:--|
| Frontend / Backend | Next.js 15 (App Router) | พัฒนาเป็น PWA |
| Database / Auth / Realtime | Supabase (PostgreSQL 15+) | Multi-tenant ด้วย `shop_id` |
| Styling | Tailwind CSS v4 | Dark Mode (class-based) |
| Language | TypeScript | Strict mode |
| Package Manager | pnpm | Workspace |
| Hosting | Vercel | หรือ VPS |
| Font | IBM Plex Sans Thai | Google Fonts |
| QR Code | promptpay-qr + qrcode | สร้างฝั่ง Client |
| Push Notification | web-push (VAPID) | ฟรี ไม่ใช้ LINE |
| Slip Verification | SlipOK / OkSlip (BYOK) | ร้านใส่ API Key เอง |
| Map (ใหม่) | Leaflet.js + OpenStreetMap | ฟรี ไม่ใช้ Google Maps API |

---

## 3. โครงสร้างโฟลเดอร์ (File Structure)

```
src/
├── app/
│   ├── [slug]/              ← หน้าเมนูลูกค้า (Public)
│   │   ├── checkout/        ← ตะกร้า + ชำระเงิน
│   │   └── page.tsx
│   ├── admin/               ← หน้าจัดการร้าน (ต้อง login)
│   │   ├── orders/          ← KDS คิวออเดอร์
│   │   ├── menu/            ← จัดการเมนู
│   │   ├── settings/        ← ตั้งค่าร้าน
│   │   └── walk-in/         ← สั่งแทนลูกค้าหน้าร้าน
│   ├── api/
│   │   ├── push/subscribe/  ← Web Push subscribe endpoint
│   │   └── webhooks/slipok/ ← รับ Webhook สลิปจาก SlipOK
│   ├── order/[orderId]/     ← หน้าติดตามสถานะออเดอร์
│   └── actions/             ← Server Actions
│       ├── auth.ts
│       ├── menu.ts
│       ├── order.ts
│       └── settings.ts
├── components/
├── lib/
│   ├── i18n/                ← ระบบ 2 ภาษา TH/EN
│   ├── theme/               ← Dark/Light Mode
│   └── thai-errors.ts       ← แปล Error Code เป็นภาษาไทย
supabase/
├── migrations/
│   ├── 20260904000001_initial_schema.sql   ← Schema หลัก
│   ├── 20260904000002_rls_policies.sql     ← RLS + Helper functions
│   └── 20260906000001_pickup_mvp.sql       ← Pickup/Delivery MVP
docs/
├── DEPLOY.md                               ← คู่มือ Deploy
└── zone-delivery-system-plan.md            ← แผนระบบเขตและการส่งของ
```

---

## 4. Database Schema (ตารางหลัก)

### ตารางที่มีอยู่แล้ว (Existing)

| Table | ความรับผิดชอบ |
|:--|:--|
| `shops` | ข้อมูลร้านค้า (Multi-tenant Root) |
| `users` | ผู้ใช้งาน (owner / staff / superadmin) |
| `categories` | หมวดหมู่เมนู |
| `menu_items` | รายการเมนูอาหาร |
| `options` | ตัวเลือกเสริม (1 ชั้น) |
| `tables` | โต๊ะและ QR Token |
| `orders` | คำสั่งซื้อ |
| `order_items` | รายการในคำสั่งซื้อ (เก็บ price_snapshot + name_snapshot) |
| `payments` | การชำระเงิน (+ trans_ref สำหรับกันสลิปซ้ำ) |
| `shop_payment_credentials` | API Key ตรวจสลิป (เข้ารหัส AES-256-GCM) |
| `payment_slips` | Raw Payload จาก SlipOK สำหรับ audit |
| `push_subscriptions` | Web Push subscription ของแต่ละเครื่อง |

### คอลัมน์สำคัญที่เพิ่มมา (Pickup MVP)
- `orders.source` → `'customer'` หรือ `'staff'`
- `orders.customer_name`, `delivery_address`, `delivery_lat`, `delivery_lng`
- `shops.has_printer`, `device_mode`, `kds_pin`, `allow_delivery`, `allow_dine_in`, `allow_takeaway`
- `shops.support_access_expires_at` → Consent-based Superadmin access

### ตารางที่จะเพิ่ม (Zone & Delivery System — ยังไม่ได้สร้าง)

| Table | ความรับผิดชอบ |
|:--|:--|
| `delivery_locations` | ตัวแปรสถานที่หลัก (Master Data, lat/lng คงที่จาก Google Earth) |
| `delivery_trips` | เที่ยวส่งของ (มี cutoff_at, delivery_time_window) |
| `delivery_trip_items` | รายการส่งรายบุคคลในแต่ละเที่ยว |
| `preorder_rounds` | รอบพรีออเดอร์ |
| `preorder_items` | ออเดอร์จองในรอบ (มี raw_input_text) |

---

## 5. RPCs สำคัญ (PostgreSQL Functions)

| Function | Caller | ความรับผิดชอบ |
|:--|:--|:--|
| `create_pickup_order(...)` | anon, authenticated | สร้างออเดอร์อย่างปลอดภัย ดึงราคาจาก DB เสมอ |
| `verify_and_confirm_payment(...)` | service_role เท่านั้น | ยืนยันสลิปและเปลี่ยนสถานะออเดอร์ (atomic) |
| `generate_order_no(shop_id)` | Internal | สร้างเลขออเดอร์ A001, A002 รายวัน |
| `has_shop_access(shop_id)` | RLS | เช็คสิทธิ์เข้าถึงข้อมูลร้าน |
| `is_shop_owner(shop_id)` | RLS | เช็คสิทธิ์เจ้าของร้าน |

---

## 6. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CREDENTIALS_ENCRYPTION_KEY=   ← AES-256-GCM 32 bytes hex
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
SLIPOK_WEBHOOK_SECRET=
SUPER_ADMIN_USER=             ← email superadmin (comma-separated)
```

---

## 7. กฎเหล็กของโปรเจกต์ (Hard Rules — ห้ามละเมิด)

1. **Price Isolation:** ราคาในบิลเก่าต้องไม่เปลี่ยนแม้ร้านแก้ราคาเมนู → ใช้ `price_snapshot` / `name_snapshot` ใน `order_items` เสมอ
2. **API Key ปลอดภัย:** ห้ามส่ง SlipOK API Key ไปฝั่ง Client → ใช้ Server Action เท่านั้น
3. **Error Code Case-sensitive:** ดักจับ Error จาก RPC ต้องตรงตัวพิมพ์ใหญ่-เล็กเป๊ะ เช่น `.includes('ORDER_LOCKED')` ไม่ใช่ `'order_locked'`
4. **สลิปซ้ำ:** ดักจับด้วย `error.code === '23505'` ไม่ใช่ match ข้อความ
5. **ห้ามแก้ไขไฟล์ migration เก่า:** เพิ่มไฟล์ migration ใหม่เสมอ
6. **ยึด Schema จริงเสมอ:** ชื่อตารางจริงคือ `users` (ไม่ใช่ `profiles`), `tables` (ไม่ใช่ `shop_tables`) — ห้ามก็อปโค้ดจากแชทเก่าโดยไม่ตรวจสอบ

---

## 8. Feature Flags ตาม Plan

| Feature | Free/Basic | Standard | Pro/Premium |
|:--|:--:|:--:|:--:|
| Takeaway (รับที่ร้าน) | ✅ | ✅ | ✅ |
| Dine-in (ทานที่ร้าน) | ❌ | ✅ | ✅ |
| Delivery (ส่งเอง + GPS) | ❌ | ❌ | ✅ |

> Superadmin สามารถเปิด `is_delivery_enabled` ให้ร้านรายกรณีได้โดยไม่ต้องเปลี่ยน Plan

---

## 9. ระบบที่กำลังพัฒนา (Zone & Delivery System)

> ดูรายละเอียดฉบับเต็มที่ [zone-delivery-system-plan.md](./zone-delivery-system-plan.md)

### ข้อตัดสินใจหลัก
- ลูกค้า **พิมพ์คอมเมนต์ Facebook เหมือนเดิม** ห้ามบังคับกดลิงก์
- **ไม่ใช้ Google Maps API Key** → Leaflet.js + OpenStreetMap + พิกัดคงที่จาก Google Earth
- **ไม่มี Live Tracking** → ไม่เคาะระบบส่งอาหารในเฟสนี้
- การส่งเป็น **Batch (รอบเวลา)** ไม่ใช่ On-demand

### 2 ระบบแยกกัน
1. **ระบบร้านส่งเอง + แผนที่จุดรับ** → เที่ยวส่ง, แผนที่ Leaflet, ปุ่มโทร, ปุ่มนำทาง
2. **ระบบพรีออเดอร์** → เปิดรอบ, นำเข้าคอมเมนต์ (OCR + Copy-Paste), สรุปยอด, ชำระ PromptPay / COD

### Text Parser (นำเข้าคอมเมนต์ Facebook)
| ช่องทาง | วิธี |
|:--|:--|
| Facebook In-app Browser | Screenshot → OCR (Tesseract.js) |
| Browser ทั่วไป | Copy-Paste → Regex Parser |

---

## 10. สิ่งที่ตัดออกและยังไม่ทำ (Out of Scope)

### ตัดออกถาวรในเฟสนี้
- ❌ ระบบปิดกะ / Z-Report / Cash Shift
- ❌ Option Groups 2 ชั้น
- ❌ LINE Notify / LINE OA
- ❌ ระบบพิมพ์บิล (ร้านไม่มีเครื่องปริ้น)
- ❌ Live Tracking คนส่ง
- ❌ คำนวณของเผื่อขาย

### รอเคาะในอนาคต
- ⏳ ระบบ Rider (ยังหาทางออกไม่ได้)
- ⏳ Dine-in QR ต่อโต๊ะ (Phase 2)
- ⏳ รายงานรายได้ครบชุด (Phase 2)

---

## 11. ลำดับการพัฒนาต่อ (Next Steps)

### Zone & Delivery System
1. `delivery_locations` Master Data + หน้า Admin จัดการ
2. `delivery_trips` + `delivery_trip_items` + ฟอร์มกรอกออเดอร์
3. หน้าแผนที่ Leaflet + ปุ่มโทร + ปุ่มนำทาง
4. `preorder_rounds` + `preorder_items` + Text Parser / OCR
5. เชื่อมพรีออเดอร์ → สร้าง delivery_trip อัตโนมัติ

## Rider System — บทเรียนจาก Phase 1 (2026-09-11)

- **PostGIS บน Supabase อยู่ schema `extensions` ไม่ใช่ `public`** — ฟังก์ชันใดที่ประกาศ `set search_path = public` แล้วเรียก `ST_*` แบบไม่ระบุ schema จะพังตอน runtime ไม่ใช่ตอนสร้าง ต้องใช้ `set search_path = public, extensions` หรือเรียกแบบ `extensions.ST_...`
- **trigger function ของโปรเจกต์นี้ชื่อ `handle_updated_at()`** (ไม่ใช่ `set_updated_at()`) — migration ใหม่ต้องอ้างชื่อนี้เท่านั้น
- **`supabase-js .update()` ไม่ error เมื่ออัปเดตไม่โดนแถวไหนเลย** — ทุกจุดที่เป็น Compare-and-Swap (รับงาน, ปฏิเสธงาน, ตัดหมดเวลา) ต้องต่อ `.select()` แล้วเช็ค `length === 0` เสมอ ไม่งั้นจะรายงานว่าสำเร็จทั้งที่ไม่มีอะไรเกิดขึ้น
- **`x != all(NULL)` ใน SQL คืนค่า NULL ทั้ง predicate** — array parameter ที่อาจเป็น NULL ต้องห่อ `coalesce(arr, '{}')` ไม่งั้น query จะไม่คืนแถวใดเลยแบบเงียบๆ
- **`ALTER TYPE ... ADD VALUE` ใน DO block ทำไม่ได้** — ถ้าครอบด้วย `exception when others then null` จะกลืน error ไปเงียบๆ ทำให้คิดว่าเพิ่ม enum สำเร็จทั้งที่ไม่ได้เพิ่ม
- **SECURITY DEFINER = ต้องเช็คสิทธิ์เอง** — ฟังก์ชันที่คืนพิกัดไรเดอร์ต้องมี `has_shop_access()` เสมอ (ยกเว้นเรียกด้วย service_role) ไม่งั้นข้อมูลตำแหน่งคนรั่วข้ามร้าน
- **สรุปยอดรายวันต้องใช้เวลาไทย** — `date(updated_at)` เป็น UTC ทำให้ยอดของช่วง 00:00–07:00 น. ตกไปวันก่อนหน้า ต้องใช้ `(updated_at at time zone 'Asia/Bangkok')::date`
- **ลำดับที่ปลอดภัยของการปิดงานไรเดอร์คือ อัปโหลด POD ก่อน แล้วค่อยบันทึก Event** — ถ้าบันทึก Event ก่อนแล้วอัปโหลดพลาด จะได้ออเดอร์ที่ระบุว่า "ส่งสำเร็จ" โดยไม่มีหลักฐานภาพ
- **ลำดับอย่างเดียวไม่พอ: Event + POD claim + Order status ต้องอยู่ใน Database Transaction เดียว** — ใช้ `finalize_rider_delivery_event()` พร้อม row lock; ห้ามแยกเป็นหลายคำสั่งจาก API
- **Rider ห้าม UPDATE `dispatch_offers` โดยตรงแม้ row เป็นของตัวเอง** — การ Accept/Reject ต้องผ่าน `respond_to_dispatch_offer()` เพื่อบังคับ Timeout, Work Session, Capacity และ Double-assignment guard แบบ atomic
- **การเปลี่ยนสถานะที่กระทบ Capacity/กะงานของ Rider ต้องใช้ rider-scoped transaction advisory lock เดียวกัน** — `respond_to_dispatch_offer()` และ `close_rider_work_session()` ล็อกด้วย Rider ID ก่อนล็อกแถว เพื่อ serialize การ Accept หลายรายการและการ Accept ที่ชนกับ Close Session โดยไม่เกิด lock-order inversion
- **Close Work Session ต้องเป็น Transaction** — ปิด Session, ลบ `rider_current_locations` และ Reject Offer ค้างผ่าน `close_rider_work_session()` เท่านั้น
- **ไฟล์ POD เป็นข้อมูลส่วนบุคคลที่เข้าถึงผ่าน Platform API เท่านั้น** — private bucket ต้องไม่มี direct SELECT policy สำหรับ Rider/Staff; server ตรวจสิทธิ์ก่อนอ่านเสมอ
- **Phase-1 Rider Rate ห้ามใช้สูตร 80/20** — Base Rate ที่ล็อกคือ 15 บาทสำหรับ 5 กม.แรก (ร้าน 7.50 + ลูกค้า 7.50); ระยะเกิน 5 กม.หรือไม่มีข้อมูลระยะทางต้อง Flag `PENDING_RATE_CARD` เพื่อให้คนตรวจ ห้ามเดาอัตราเพิ่มเอง
