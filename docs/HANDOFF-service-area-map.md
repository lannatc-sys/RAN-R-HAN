# Handoff — Service Area Map & PromptPay Approval

> อัปเดต 2026-09-14 เวลา ~01:40 Asia/Bangkok
> branch `feat/service-area-map-ui-scaffold` ล่าสุด `16c6447` push แล้ว
> worktree `D:\system make\Ran-R-HAN\.worktrees\service-area-map-ui-scaffold`
>
> อัปเดต 2026-09-14 (งานที่ 1 — ล็อกพร้อมเพย์ฝั่งร้าน, branch `feat/promptpay-lock-ui`)
> ทำเสร็จแล้ว รายละเอียดดูหัวข้อ "งานที่ 1 — ผลตรวจจริง" ท้ายไฟล์

---

## สถานะ production ตอนนี้

| migration | apply แล้ว | ผล |
| :--- | :--- | :--- |
| `20260914000001_service_area_polygon` | **ใช่** | เพิ่ม `shops.service_area_polygon`, `rider_work_area_polygon`, ฟังก์ชัน `is_point_in_shop_area`, `parse_area_polygon` |
| `20260914000002_superadmin_only_service_area` | **ใช่** | `update_shop_geo` และ `set_shop_service_area_settings` เหลือ `is_superadmin` + เพิ่ม `set_shop_service_area_polygon` |
| `20260914000003_promptpay_change_requests` | **ยังไม่** | ตาราง + RPC คำขอเปลี่ยนพร้อมเพย์ |
| `20260914000004_read_shop_area_polygons` | **ใช่** | `get_shop_area_polygons` คืน polygon เป็น GeoJSON |
| `20260914000005_enforce_polygon_service_area` | **ยังไม่** | `enforce_service_area_for_new_orders` เรียก `is_point_in_shop_area` (C4) |

ตรวจหลัง apply แล้วว่าสองฟังก์ชันแรก **ยังมี** `pg_advisory_xact_lock`, `select for update`, ลูป `order by rider_id` และ `returns jsonb` ครบ

**พื้นที่ยังไม่ถูกบังคับใช้จริงบน production** โค้ด C4 เขียนและทดสอบกับ PostGIS จริงแล้ว
(`20260914000005`) แต่ยัง **ไม่ได้ apply** เพราะเปลี่ยนพฤติกรรมการรับออเดอร์
ต้อง apply เป็นรอบแยกเมื่อเจ้าของโปรเจกต์สั่ง

**migration 20260914000001-000005 ไม่เคยถูกลงทะเบียนใน `scripts/run-db.js`**
สามไฟล์แรกถูก apply เข้า production ด้วยมือ ฐานข้อมูลที่สร้างใหม่จาก script จึงไม่มี polygon เลย
ตอนนี้ลงทะเบียนครบทั้งห้าไฟล์แล้ว (ขั้น 1.19-1.23)

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

## รอบ 2026-09-14 (Claude Code, branch `feat/superadmin-shop-editor`)

commit `089ed0f` และรอบถัดมาบน worktree `.worktrees/superadmin-shop-editor` โลคัลอย่างเดียว ยังไม่ push

**งานที่ 4 — แผงแก้ข้อมูลร้านพื้นฐาน: DONE**
- `updateShopBasicInfoAction` ใน `src/app/actions/superadmin.ts` แก้ชื่อ เบอร์โทร ที่อยู่ ลิงก์โลโก้
- โมดัลใหม่ในหน้า `/superadmin/stores` (`StoresManagementClient.tsx`) ใช้รูปแบบเดียวกับโมดัลเปลี่ยนแพ็กเกจ
- ไม่รับ `kds_pin` และไม่รับพร้อมเพย์ตามที่ตกลงไว้ มีเทสคุมสองข้อนี้โดยเฉพาะ
- เขียน `audit_logs` (`user_id` / `details` / `entity_type`) ว่าแก้ฟิลด์ไหน
- **ยังไม่มีอัปโหลดโลโก้เป็นไฟล์** รับเป็นลิงก์ https:// เท่านั้น เพราะทั้งระบบยังไม่มีที่ไหนเขียน
  `logo_url` เลย และ `Shop.logo` ใน types เป็นคอลัมน์ผี ฐานข้อมูลมีแค่ `logo_url`

**งานที่ 5 (C4) — polygon มีผลตอนรับออเดอร์: โค้ดเสร็จ ยังไม่ apply**
- `supabase/migrations/20260914000005_enforce_polygon_service_area.sql`
  แทนบล็อกวัดระยะเดิมด้วย `is_point_in_shop_area` ตัวเดียวกับเส้นทางอื่น
  พฤติกรรม fail-closed เดิมคงครบเพราะ predicate คืน false ทุกกรณีที่พิกัด/รัศมีไม่ครบ

**gate ฐานข้อมูลที่ค้าง Standby มานาน — ตอนนี้รันได้จริงแล้ว**
- `test/supabase-shim.sql` (ใหม่) เติม schema `auth`/`storage`/`extensions`, role, `auth.uid()`,
  `storage.foldername()` และย้าย postgis เข้า schema `extensions` ให้ฐานข้อมูล postgres เปล่า
  รัน migrations ของโปรเจกต์ได้ **ใช้กับคอนเทนเนอร์ที่พร้อมทิ้งเท่านั้น**
- ขั้นตอนที่ใช้จริง: `postgis/postgis:15-3.3` ในคอนเทนเนอร์ → apply shim → `node scripts/run-db.js`
  → `TEST_DATABASE_URL=... npm run test:db:service-area`

**เทสที่ล้าสมัยและไม่มีใครเห็นเพราะ gate นี้ไม่เคยรัน**
`test/service-area-postgres.integration.cjs` ยังยืนยันว่า *เจ้าของร้านแก้พื้นที่ตัวเองได้*
ซึ่งขัดกับ `20260914000002` ที่ย้ายสิทธิ์ไป superadmin ไปแล้ว แก้ให้ตรงของจริงแล้ว
พร้อมเพิ่มเคส superadmin ทำได้ / เจ้าของร้านโดนปฏิเสธ

**ยังไม่ได้ทำ / NOT PERFORMED**
- ไม่ได้ apply `20260914000005` ลง production และไม่ได้แตะ production database
- ไม่ได้ทดสอบ UI บนเบราว์เซอร์จริง โมดัลแก้ข้อมูลร้านตรวจด้วย build + type เท่านั้น
- `test/supabase-shim.sql` ยังไม่ได้ผูกเข้า CI หรือ script ใด ต้องรันด้วยมือ

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
npm run test:unit        ต้องได้ 273 ผ่าน 0 fail (branch feat/superadmin-shop-editor)
npx tsc --noEmit
npm run build
git diff --check
```

**`test:unit` ใน `package.json` ไล่ชื่อไฟล์เทสทีละไฟล์ ไม่ได้ใช้ glob**
เทสไฟล์ใหม่ที่ไม่ถูกเพิ่มเข้าไปในรายการนั้นจะไม่ถูกรันใน gate เลย ทั้งที่รันเดี่ยว ๆ ผ่าน
ตอนรวมงานต้องเช็กว่าเทสใหม่ของทุก branch ถูกเพิ่มเข้ารายการแล้ว

gate ฐานข้อมูล เมื่อแตะ migration หรือ RPC ของพื้นที่ให้บริการ:

```
TEST_DATABASE_URL=postgres://.../<disposable db> npm run test:db:service-area
```

ผลรันจริง 2026-09-14 บน PostGIS 3.3 ในคอนเทนเนอร์: **14 PASS 0 FAIL**
พิสูจน์แล้วว่าไม่ใช่เทสลอย — ถอด `20260914000005` ออกแล้วเคส
"polygon beats the radius" แดงจริง เคสอื่นยังเขียว

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

---

## งานที่ 1 — ผลตรวจจริง (ล็อกช่องพร้อมเพย์ฝั่งร้าน + ปุ่มขอแก้ไข)

ทำบน branch `feat/promptpay-lock-ui` (worktree
`D:\system make\Ran-R-HAN\.worktrees\promptpay-lock-ui`) ขอบเขตตาม task:
`src/app/admin/settings/SettingsClient.tsx`, `src/app/actions/settings.ts`,
`test/promptpay-lock-ui.test.ts` (ไฟล์ใหม่), `docs/HANDOFF-service-area-map.md`

- ช่อง `promptpayId` / `promptpayName` เป็น read-only ด้วย
  `SHOP_CAN_EDIT_PROMPTPAY = false` รูปแบบเดียวกับ `SHOP_CAN_EDIT_LOCATION`
  (`disabled` + `readOnly` + พื้นหลัง `bg-stone-50`)
- แสดงประเภทเลขปัจจุบัน: 10 หลัก = เบอร์โทรศัพท์, 13 หลัก = เลขบัตรประชาชน
  (`getPromptpayIdKind`)
- ปุ่ม "ขอแก้ไขพร้อมเพย์" เปิดฟอร์ม เรียก `requestPromptpayChangeAction`
  ตัวเดิม (ไม่เขียน action ใหม่) ถ้ามีคำขอค้างแสดง "รออนุมัติ" แทนปุ่ม
  สถานะค้างอ่านผ่าน `getPendingPromptpayRequestAction` ตัวใหม่
  (คืนแค่ `hasPending` + `requestedAt` ไม่คืนเลขเต็ม)
- `promptpay_id` / `promptpay_name` ถูกเอาออกจาก `updateShopSettingsAction`
  ทั้งฝั่ง client (ไม่ส่ง) และฝั่ง server (ไม่รับ/ไม่เขียน) ร้านแก้ผ่านฟอร์มหลักไม่ได้แล้ว
- กับดัก: `settings.ts` ยังคืนเฉพาะข้อความไทยคงที่ผ่าน `formatThaiError`
  ไม่คืน `error.message` ดิบ, Telegram ใช้ `maskDigits` เหมือนเดิม,
  ธีม admin ไม่เปลี่ยน (ใช้คลาส stone/amber เดิมของไฟล์)

Gate รันจริง:

- `npm run test:unit` → 270 ผ่าน 0 fail
- `npx tsx --test test/promptpay-lock-ui.test.ts` → 10 ผ่าน 0 fail
  (พิสูจน์ไม่ใช่เทสต์ลอย: stash โค้ดกลับเป็นก่อนแก้แล้วรัน ได้ fail 7/10 จากนั้น pop คืน)
- `npx tsc --noEmit` → ผ่าน (exit 0)
- `npm run build` → ผ่าน
- `git diff --check` → ผ่าน
- สแกน secret ก่อน commit (`git diff --cached | grep -inE ...`) →
  ไม่พบค่าเพิ่มใหม่ (match เดียวคือคอมเมนต์เดิม `SLIPOK_API_KEY` ในบรรทัด context)

NOT PERFORMED:

- `pnpm test:db:service-area` (งานนี้ไม่แตะ migration จึงไม่ต้องรัน)
- ทดสอบ UI บนเบราว์เซอร์จริง / ทดสอบยื่นคำขอชน production database
- งานที่ 2-5 ใน handoff นี้ยังไม่ได้ทำ (เมนูคำขออนุมัติฝั่ง superadmin,
  apply migration 20260914000003, แผงแก้ข้อมูลร้าน, C4 enforce polygon)

- สิทธิ์เจ้าของร้าน: เปลี่ยน `is_superadmin()` กลับเป็น
  `has_shop_access(p_shop_id)` ในสองฟังก์ชัน แล้วตั้งค่าคงที่
  `SHOP_CAN_EDIT_SERVICE_AREA` และ `SHOP_CAN_EDIT_LOCATION` เป็น `true`
- polygon: คอลัมน์และฟังก์ชันเพิ่มเข้ามาเฉย ๆ ยังไม่มีใครเรียก ลบได้ถ้าต้องการ
