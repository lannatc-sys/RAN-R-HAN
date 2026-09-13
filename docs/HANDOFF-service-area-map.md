# Handoff — Service Area Map & PromptPay Approval

> อัปเดต 2026-09-14 เวลา ~01:40 Asia/Bangkok
> branch `feat/service-area-map-ui-scaffold` ล่าสุด `16c6447` push แล้ว
> worktree `D:\system make\Ran-R-HAN\.worktrees\service-area-map-ui-scaffold`

---

## สถานะ production ตอนนี้

| migration | apply แล้ว | ผล |
| :--- | :--- | :--- |
| `20260914000001_service_area_polygon` | **ใช่** | เพิ่ม `shops.service_area_polygon`, `rider_work_area_polygon`, ฟังก์ชัน `is_point_in_shop_area`, `parse_area_polygon` |
| `20260914000002_superadmin_only_service_area` | **ใช่** | `update_shop_geo` และ `set_shop_service_area_settings` เหลือ `is_superadmin` + เพิ่ม `set_shop_service_area_polygon` |
| `20260914000003_promptpay_change_requests` | **ยังไม่** | ตาราง + RPC คำขอเปลี่ยนพร้อมเพย์ |
| `20260914000004_read_shop_area_polygons` | **ใช่** | `get_shop_area_polygons` คืน polygon เป็น GeoJSON |

ตรวจหลัง apply แล้วว่าสองฟังก์ชันแรก **ยังมี** `pg_advisory_xact_lock`, `select for update`, ลูป `order by rider_id` และ `returns jsonb` ครบ

**พื้นที่ยังไม่ถูกบังคับใช้จริง** `enforce_service_area_for_new_orders` ยังไม่เรียก `is_point_in_shop_area`

---

## ทำเสร็จแล้ว

- Scaffold UI + isolation gate (`test/service-area-map-scaffold.test.ts`)
- หน้า `/superadmin/service-area-map` + Leaflet จริง วาด polygon ได้
- ลิงก์ในไซด์บาร์ superadmin
- ชั้นปักหมุดร้าน เลือกร้าน วงรัศมีปัจจุบัน คลิกแผนที่ปักหมุดร้านได้
- ปุ่มบันทึกพื้นที่ → `set_shop_service_area_polygon`
- เจ้าของร้านดูพิกัดและรัศมีได้แต่แก้ไม่ได้ (คุมด้วยค่าคงที่ไฟล์ละตัว)
- backend คำขอเปลี่ยนพร้อมเพย์ + แจ้งเตือน Telegram (เงียบถ้าไม่ตั้งค่า)
- **โหลดพื้นที่ที่บันทึกไว้กลับมาแก้ต่อได้** เลือกร้านแล้ว editor ขึ้นรูปเดิม
  ไม่ใช่ fixture สาธิต มีเทส round-trip คุมว่าเซฟแล้วโหลดแล้วเซฟซ้ำรูปไม่เพี้ยน

---

## เหลือทำ ตามลำดับ

### 1. UI ฝั่งร้าน — ล็อกช่องพร้อมเพย์ + ปุ่มขอแก้ไข

ไฟล์ `src/app/admin/settings/SettingsClient.tsx` ราวบรรทัด 1375-1402

- ทำช่อง `promptpayId` / `promptpayName` เป็น read-only แบบเดียวกับที่ทำกับพิกัด
  (ดูตัวอย่าง `SHOP_CAN_EDIT_LOCATION` ในไฟล์เดียวกัน)
- แสดงว่าเลขปัจจุบันเป็นแบบไหน: 10 หลัก = เบอร์โทร, 13 หลัก = บัตรประชาชน
- ปุ่ม "ขอแก้ไขพร้อมเพย์" เปิดฟอร์ม แล้วเรียก
  `requestPromptpayChangeAction` ใน `src/app/actions/settings.ts` (เขียนแล้ว)
- ถ้ามีคำขอค้างอยู่ ให้แสดงสถานะรออนุมัติแทนปุ่ม

**อย่าลืม** `promptpay_id` / `promptpay_name` ยังถูกส่งใน `updateShopSettingsAction`
ต้องเอาสองฟิลด์นี้ออกจากเส้นทางนั้น ไม่งั้นร้านยังแก้ได้ผ่านฟอร์มตั้งค่าหลัก

### 2. เมนูใหม่ "คำขออนุมัติ" ฝั่ง superadmin

- action ใน `src/app/actions/superadmin.ts`
  - `listPromptpayRequestsAction()` — อ่านคิว ยังไม่ได้เขียน
  - `reviewPromptpayRequestAction(requestId, approve, note)` — เรียก RPC
    `review_promptpay_change` ยังไม่ได้เขียน
- หน้า `src/app/superadmin/approvals/page.tsx` ยังไม่ได้สร้าง
- เพิ่มเมนูใน `src/components/superadmin/SuperadminSidebar.tsx`
  (ทำแบบเดียวกับ "พื้นที่ให้บริการ" ที่เพิ่มไว้แล้ว) พร้อมตัวเลขจำนวนคำขอค้าง
- แสดงเลขเต็มได้เฉพาะหน้านี้ ที่อื่นให้ใช้ `maskDigits` จาก `src/lib/telegram.ts`

### 3. apply migration 20260914000003

ทำ **หลัง** UI เสร็จ ไม่งั้นมีตารางที่ไม่มีใครใช้

### 4. แผงแก้ข้อมูลร้านพื้นฐาน

เจ้าของระบบขอไว้ตอนแรก: ชื่อ เบอร์โทร ที่อยู่ โลโก้ แก้จากฝั่ง superadmin
ได้โดยไม่ต้องสวมรอยเข้าร้าน **ไม่รวม** `kds_pin` และ **ไม่รวม** พร้อมเพย์
(พร้อมเพย์ไปทางคำขออนุมัติแล้ว)

### 5. C4 — ให้ polygon มีผลจริง

แก้ `enforce_service_area_for_new_orders` ให้เรียก `is_point_in_shop_area`
**เปลี่ยนพฤติกรรมรับออเดอร์บน production ต้องทำเป็นรอบแยกและทดสอบต่างหาก**

---

## กับดักที่เสียเวลาไปแล้ว อย่าเหยียบซ้ำ

**1. ห้ามคัดลอก body ของ RPC มาเขียนใหม่**
`update_shop_geo` และ `set_shop_service_area_settings` มี advisory lock,
row lock และลูปเรียงตาม rider_id กันเดดล็อก การเขียนใหม่จากที่เห็นบางส่วน
ทำตกไปแล้วครั้งหนึ่ง วิธีที่ใช้จริงคือให้ migration อ่าน `pg_get_functiondef`
แล้วแทนที่เฉพาะบรรทัดตรวจสิทธิ์ และ raise ถ้าหาไม่เจอ

**2. `audit_logs` ใช้ชื่อคอลัมน์ `user_id` และ `details`**
ไม่ใช่ `actor_id` / `detail` และ `entity_type` เป็น NOT NULL

**3. เทส `authorization-regression` ห้าม `settings.ts` คืน `error.message` ดิบ**
ต้องแปลเป็นข้อความคงที่ก่อนส่งกลับ client เทสจับได้จริงมาแล้ว

**4. Superadmin เป็นธีมสว่าง ไม่ใช่ธีมมืด**
`bg-slate-100/70` พร้อมไซด์บาร์มืด สีเข้มใน `layout.tsx` เป็นของสาขา
ปฏิเสธการเข้าถึงเท่านั้น ห้ามใส่คลาส `dark` ที่ตัวครอบ และหน้า superadmin
อื่นใช้ `dark:` เป็นศูนย์ทุกไฟล์

**5. ทิศวงแหวน polygon ไม่ทำให้พื้นที่กลับด้าน**
ทดสอบกับ PostGIS 3.3.7 ของโปรเจกต์แล้ว `ST_Covers` ตอบเหมือนกันทั้งตามเข็ม
และทวนเข็ม `toCounterClockwise` เก็บไว้เพราะ RFC 7946 ไม่ใช่เพราะกันบั๊ก

**6. isolation gate จับ import ไม่ใช่คำในไฟล์**
`revalidatePath('/superadmin/service-area-map')` เคยทำให้เทสแดงมาแล้ว
ตอนนี้แก้ให้จับเฉพาะ import จริง มีเทสคุมทั้งสองฝั่ง

**7. เลขหมายเลขพร้อมเพย์อาจเป็นเลขบัตรประชาชน**
เป็นข้อมูลส่วนบุคคลตาม PDPA ห้ามส่งเต็มเข้า Telegram ใช้ `maskDigits`

---

## Gate ที่ต้องผ่านก่อน commit ทุกครั้ง

```
npm run test:unit        ต้องได้ 268 ผ่าน 0 fail
npx tsc --noEmit
npm run build
git diff --check
```

---

## ข้อมูลจริงที่ควรรู้

- ร้านทั้งหมด 4 ร้าน **ปักหมุดแล้วเพียง 1 ร้าน** (ครัวป้าแดง `19.3005, 97.9678`)
- **ยังไม่มีร้านใดเปิด `service_area_enabled`** เส้นทางบังคับใช้พื้นที่จึงยัง
  ไม่เคยทำงานจริงบน production สักครั้ง
- `TELEGRAM_SUPERADMIN_CHAT_ID` ยังไม่ได้ตั้ง การแจ้งเตือนจะถูกข้ามอย่างเงียบ ๆ
  และบอทยังไม่ตอบ `/start` ซึ่งเป็นคนละเรื่องกับงานนี้

## ย้อนกลับ

- สิทธิ์เจ้าของร้าน: เปลี่ยน `is_superadmin()` กลับเป็น
  `has_shop_access(p_shop_id)` ในสองฟังก์ชัน แล้วตั้งค่าคงที่
  `SHOP_CAN_EDIT_SERVICE_AREA` และ `SHOP_CAN_EDIT_LOCATION` เป็น `true`
- polygon: คอลัมน์และฟังก์ชันเพิ่มเข้ามาเฉย ๆ ยังไม่มีใครเรียก ลบได้ถ้าต้องการ
