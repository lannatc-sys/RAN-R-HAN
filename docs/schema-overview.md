# โครงสร้างฐานข้อมูลเบื้องต้น: ระบบร้านอาหารแบบ Multi-tenant (SaaS)

> สรุปโครงสร้างตารางหลักและคอลัมน์สำคัญของระบบ RAN-R-HAN สำหรับใช้อ้างอิงอย่างรวดเร็ว (Quick Reference)  
> *สำหรับการสร้างตารางและ DDL ฉบับสมบูรณ์ ให้ดูที่โฟลเดอร์ `supabase/migrations/`*

---

## 1. ภาพรวมตารางหลัก (Core Tables)

```text
shops        (id, slug, name, logo, promptpay_id, promptpay_name,
              plan, status, expires_at, service_charge, vat_mode,
              signup_source, has_printer, device_mode, kds_pin)
users        (id, shop_id, role) -- superadmin | owner | staff
categories   (id, shop_id, name, sort_order)
menu_items   (id, shop_id, category_id, name, description,
              price, image_url, is_available, sort_order)
options      (id, menu_item_id, name, price_delta) -- เผ็ดน้อย/พิเศษ/ไข่ดาว
tables       (id, shop_id, table_no, qr_token, status)
orders       (id, shop_id, table_id, order_no, type, source,
              status, subtotal, total, note, customer_phone,
              pickup_at, created_at)
order_items  (id, order_id, menu_item_id, name_snapshot,
              price_snapshot, qty, options_json)
payments     (id, order_id, method, amount, ref, trans_ref,
              slip_url, verified_at, status)
```

---

## 2. ตารางส่วนขยายระบบ (Extension Tables)

- **`shop_payment_credentials`**: จัดเก็บ API Key ตรวจสอบสลิป (SlipOK) แบบเข้ารหัส AES-256-GCM แยกตามร้าน
- **`payment_slips`**: จัดเก็บ Payload ข้อมูลสลิปดิบจาก Webhook สำหรับการตรวจสอบย้อนหลัง
- **`push_subscriptions`**: จัดเก็บ Subscription สำหรับ Web Push Notification ของอุปกรณ์พนักงานและเจ้าของร้าน

---

## 3. เอกสารอ้างอิงที่เกี่ยวข้อง

- [docs/KNOWLEDGE.md](file:///d:/system%20make/Ran-R-HAN/docs/KNOWLEDGE.md) — แหล่งความจริงหลัก (Single Source of Truth) ของโปรเจกต์
- [docs/Blueprint.md](file:///d:/system%20make/Ran-R-HAN/docs/Blueprint.md) — ขอบเขตและฟังก์ชันการทำงานของระบบ
- โฟลเดอร์ Migration จริง: `supabase/migrations/`