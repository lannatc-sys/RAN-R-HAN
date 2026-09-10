# Router Map — RAN-R-HAN

> แผนผัง Routes ทั้งหมดของโปรเจกต์ พร้อมบทบาทและสิทธิ์การเข้าถึง

---

## Routes ที่มีอยู่แล้ว (Existing)

### Public Routes (ไม่ต้อง Login)

| Route | File | บทบาท | หมายเหตุ |
|:--|:--|:--|:--|
| `/` | `app/page.tsx` | Landing Page | แสดงรายชื่อร้าน + ลิงก์ Login/Register |
| `/[slug]` | `app/[slug]/page.tsx` | เมนูอาหารของร้าน | Dynamic Route ตาม slug ร้าน |
| `/[slug]/checkout` | `app/[slug]/checkout/page.tsx` | ตะกร้า + ชำระเงิน | Takeaway / Dine-in / Delivery |
| `/order/[orderId]` | `app/order/[orderId]/page.tsx` | ติดตามสถานะออเดอร์ | Realtime polling |
| `/login` | `app/login/page.tsx` | เข้าสู่ระบบ | สำหรับ owner / staff |
| `/register` | `app/register/page.tsx` | ลงทะเบียนร้านใหม่ | — |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth Callback | Supabase Auth |

### Admin Routes (ต้อง Login เป็น owner/staff)

> Layout: `app/admin/layout.tsx` — ดึง shop ตาม user session
> `/admin` → redirect ไป `/admin/orders` อัตโนมัติ

| Route | File | บทบาท |
|:--|:--|:--|
| `/admin/orders` | `app/admin/orders/` | KDS คิวออเดอร์ (Realtime) |
| `/admin/menu` | `app/admin/menu/` | จัดการเมนู/หมวดหมู่ |
| `/admin/settings` | `app/admin/settings/` | ตั้งค่าร้าน (PIN, PromptPay, SlipOK, Plan) |
| `/admin/walk-in` | `app/admin/walk-in/` | สั่งอาหารแทนลูกค้าหน้าร้าน |

### Superadmin Routes (ต้อง Login เป็น superadmin)

> Layout: `app/superadmin/layout.tsx`

| Route | File | บทบาท |
|:--|:--|:--|
| `/superadmin` | `app/superadmin/page.tsx` | Dashboard ภาพรวมแพลตฟอร์ม |
| `/superadmin/stores` | `app/superadmin/stores/page.tsx` | จัดการร้านค้าทั้งหมด |
| `/superadmin/plans` | `app/superadmin/plans/page.tsx` | จัดการ Plan และฟีเจอร์ |
| `/superadmin/announcements` | `app/superadmin/announcements/page.tsx` | ประกาศสำหรับร้านค้า |

### API Routes

| Route | Method | บทบาท | Auth |
|:--|:--|:--|:--|
| `/api/auth/register` | POST | ลงทะเบียนร้านใหม่ | Public |
| `/api/push/subscribe` | POST | บันทึก Web Push Subscription (Staff KDS) | Authenticated |
| `/api/webhooks/slipok` | POST | รับ Webhook สลิปจาก SlipOK | Secret Header |
| `/api/cron/data-retention` | GET/POST | ลบข้อมูลตามนโยบาย Retention (PDPA) | Bearer CRON_SECRET |
| `/api/telegram/webhook` | POST | รับ Event จาก Telegram Bot (เชื่อมโยง chat_id ออเดอร์ลูกค้า) | Secret Header / Public |
| `/auth/callback` | GET | Supabase OAuth Callback | — |

---

## Routes ที่จะเพิ่มใหม่ (Delivery System — ยังไม่สร้าง)

> เพิ่มเป็น Sub-module ใน `/admin/delivery/` แยกขาดจาก routes เดิมทั้งหมด
> Layout เดิม `app/admin/layout.tsx` ครอบคลุมให้อัตโนมัติ (Auth + Navbar)

| Route | บทบาท |
|:--|:--|
| `/admin/delivery` | → redirect ไป `/admin/delivery/trips` |
| `/admin/delivery/locations` | จัดการสถานที่รับสินค้า (Master Data) |
| `/admin/delivery/trips` | รายการเที่ยวส่งของทั้งหมด |
| `/admin/delivery/trips/new` | สร้างเที่ยวส่งของใหม่ |
| `/admin/delivery/trips/[id]` | แผนที่ + รายการส่งรายบุคคลของเที่ยวนั้น |
| `/admin/delivery/preorder` | รายการรอบพรีออเดอร์ทั้งหมด |
| `/admin/delivery/preorder/new` | เปิดรอบพรีออเดอร์ใหม่ |
| `/admin/delivery/preorder/[id]` | กรอกออเดอร์จากคอมเมนต์ + OCR/Parser |

---

## จุดที่ต้องแตะโค้ดเดิม (Minimal Touch Points)

| ไฟล์ | การเปลี่ยนแปลง | ขนาดผลกระทบ |
|:--|:--|:--|
| `components/admin/AdminNavbar.tsx` | เพิ่มลิงก์ "จัดส่ง" 1 รายการ | 🟢 เล็กน้อย |
| `lib/types.ts` | เพิ่ม Type สำหรับ DeliveryLocation, DeliveryTrip, PreorderRound | 🟢 เล็กน้อย (append เท่านั้น) |

**ไฟล์ที่ไม่แตะเลย:**
- `app/[slug]/` และ `app/order/` — Public routes ทั้งหมด
- `app/admin/orders/` — KDS ที่มีอยู่
- `app/admin/menu/` — จัดการเมนู
- `app/admin/settings/` — ตั้งค่าร้าน
- `app/admin/walk-in/` — สั่งแทนลูกค้า
- `app/superadmin/` — ทุกหน้า Superadmin
- `app/actions/order.ts`, `auth.ts`, `menu.ts`, `settings.ts` — Server Actions เดิม
- `app/api/webhooks/`, `app/api/push/` — API Routes เดิม

---

## Server Actions ที่จะเพิ่มใหม่ (ไฟล์ใหม่ทั้งหมด)

```
app/actions/
├── order.ts        ← เดิม ไม่แตะ
├── menu.ts         ← เดิม ไม่แตะ
├── settings.ts     ← เดิม ไม่แตะ
├── auth.ts         ← เดิม ไม่แตะ
├── superadmin.ts   ← เดิม ไม่แตะ
└── delivery.ts     ← ใหม่ (CRUD delivery_locations, trips, items, preorder)
```

---

## API Routes ที่จะเพิ่มใหม่

```
app/api/
├── push/           ← เดิม ไม่แตะ (Web Push สำหรับ Staff/KDS)
├── webhooks/       ← เดิม ไม่แตะ (SlipOK Webhook)
├── cron/           ← เดิม ไม่แตะ (Data Retention)
├── delivery/
│   └── parse-text/ ← ใหม่ (Text Parser + OCR endpoint)
│       └── route.ts
└── telegram/       ← ใหม่ (Telegram Customer Order Updates)
    └── webhook/
        └── route.ts
```

---

## สรุป Dependency Map

```
[Admin Layout] ─────────────────────────────────────┐
     │                                               │
     ├── /admin/orders      (เดิม - ไม่แตะ)          │
     ├── /admin/menu        (เดิม - ไม่แตะ)          │
     ├── /admin/settings    (เดิม - ไม่แตะ)          │
     ├── /admin/walk-in     (เดิม - ไม่แตะ)          │
     │                                               │
     └── /admin/delivery    (ใหม่ - แยกขาด)          │
          ├── /locations                             │
          ├── /trips                                 │
          │    └── /[id]  ──── Leaflet Map           │
          └── /preorder                              │
               └── /[id]  ──── Parser/OCR           │
                                                     │
[delivery.ts Actions] ─── [DB: delivery_locations,  │
                               delivery_trips,       │
                               delivery_trip_items,  │
                               preorder_rounds,      │
                               preorder_items]        │
                                   ↑                 │
                      (ไม่แตะตารางเดิมเลย)           │
```
