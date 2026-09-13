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
| `/api/cron/dispatch-timeout` | GET/POST | หมดเวลาข้อเสนองาน แล้วจ่ายต่อ | Bearer CRON_SECRET |
| `/api/cron/rider-geofence-sweep` | GET/POST | ปิดกะไรเดอร์ที่อยู่นอกพื้นที่เกิน 15 นาที | Bearer CRON_SECRET |
| `/auth/callback` | GET | Supabase OAuth Callback | — |

---

## Delivery Routes (สร้างแล้ว)

| Route | File | บทบาท |
|:--|:--|:--|
| `/admin/delivery` | `app/admin/delivery/` | ภาพรวมระบบจัดส่ง |
| `/admin/delivery/locations` | `app/admin/delivery/locations/` | จัดการสถานที่หลัก (Master Data) |
| `/admin/delivery/trips` | `app/admin/delivery/trips/` | รายการเที่ยวส่งของ |
| `/admin/delivery/trips/new` | `app/admin/delivery/trips/new/` | สร้างเที่ยวส่งใหม่ |
| `/admin/delivery/trips/[id]` | `app/admin/delivery/trips/[id]/` | รายละเอียดเที่ยวส่ง |
| `/admin/delivery/preorder` | `app/admin/delivery/preorder/` | รายการรอบพรีออเดอร์ |
| `/admin/delivery/preorder/[id]` | `app/admin/delivery/preorder/[id]/` | จัดการออเดอร์ในรอบ |

## Rider & Dispatch Routes (สร้างแล้ว)

| Route | File | บทบาท | Auth |
|:--|:--|:--|:--|
| `/rider` | `app/rider/page.tsx` | PWA ฝั่งไรเดอร์ — กะงาน, รับงาน, ส่งพิกัด | rider |
| `/rider/login` | `app/rider/login/page.tsx` | เข้าสู่ระบบไรเดอร์ | Public |
| `/admin/dispatch` | `app/admin/dispatch/` | จ่ายงานไรเดอร์ | owner/staff |
| `/admin/riders` | `app/admin/riders/` | จัดการไรเดอร์ | owner |
| `/admin/service-area` | `app/admin/service-area/` | ตั้งค่าพื้นที่ให้บริการ (geofence) | owner |
| `/admin/settlement` | `app/admin/settlement/` | ปิดยอดรายวัน | owner |

### Rider API

| Route | Method | บทบาท |
|:--|:--|:--|
| `/api/rider/location` | POST | ส่งพิกัดล่าสุด → `report_rider_location` |
| `/api/rider/session/start` | POST | เปิดกะ |
| `/api/rider/session/close` | POST | ปิดกะ |
| `/api/rider/session/active` | GET | กะที่เปิดอยู่ |
| `/api/rider/offers/active` | GET | ข้อเสนองานที่ค้างอยู่ |
| `/api/rider/offer/[offerId]/respond` | POST | รับ/ปฏิเสธงาน |
| `/api/rider/orders/active` | GET | งานที่กำลังทำ |
| `/api/rider/order/[orderId]/event` | POST | บันทึกเหตุการณ์ระหว่างส่ง |
| `/api/rider/order/[orderId]/pod` | POST | อัปโหลดหลักฐานการส่ง |
| `/api/rider/summary` | GET | สรุปรายได้/รอบงาน |

ทุก endpoint ใต้ `/api/rider/*` ต้องเป็น rider ที่ผูกกับร้านนั้น (`is_rider_of_shop`)

---

## หมายเหตุสำหรับงานที่จะแตะพื้นที่/แผนที่

การบังคับพื้นที่ให้บริการทำที่ **ชั้น database** ผ่าน `enforce_service_area_for_new_orders` ไม่ใช่ที่ route — การเพิ่มหน้าจอแผนที่ไม่ควรมี logic ตรวจพื้นที่ของตัวเอง

`/api/cron/rider-geofence-sweep` และ `/api/cron/dispatch-timeout` ถูกยิงทุกนาทีจาก cron-job.org บน production
