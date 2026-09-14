# RAN-R-HAN — Project Handoff

> แหล่งข้อมูล handoff หลักเพียงไฟล์เดียวของโปรเจกต์
>
> อัปเดตล่าสุด: 2026-09-13 (Asia/Bangkok)
>
> Schema, migrations, production code และผลทดสอบที่รันจริงล่าสุด มีน้ำหนักสูงกว่าเอกสารนี้เสมอ

## 1. สถานะที่ตรวจสดล่าสุด

ตรวจจาก checkout `D:\system make\Ran-R-HAN` เมื่อ 2026-09-13 ก่อนรวมเอกสาร:

| รายการ | สถานะ |
| --- | --- |
| Working tree | สะอาดก่อนงานเอกสารรอบนี้ |
| Branch ปัจจุบัน | `fix/auth-idor-hardening` |
| HEAD | `da08f4a` — strip UTF-8 BOM ก่อนรัน payment-slips migration |
| Remote branch | `origin/fix/auth-idor-hardening` อยู่ที่ commit เดียวกัน |
| PR ของ branch ปัจจุบัน | กำลังจะเปิด |
| PR #2 | MERGED เข้า main เรียบร้อย (commit `6b78578`) |

[PR #2 — Service area enforcement, security fixes, and cron scheduling](https://github.com/lannatc-sys/RAN-R-HAN/pull/2) (MERGED)

สถานะ GitHub/Vercel เปลี่ยนได้ ให้ตรวจใหม่ก่อน merge หรือ deploy

## 1.5 รอบ 2026-09-14 — สอง PR ที่เปิดค้างอยู่ อ่านก่อนเริ่มงาน

มีสอง branch ที่ทำคู่ขนานและ **ยังไม่ merge** อย่าเริ่มงานใหม่ทับสองอันนี้

### PR #4 — `feat/service-area-integration`

https://github.com/lannatc-sys/RAN-R-HAN/pull/4 (ฐานจาก `feat/service-area-map-ui-scaffold`)

รวมสี่งาน: ล็อกพร้อมเพย์ฝั่งร้าน, เมนูคำขออนุมัติฝั่ง superadmin,
แผงแก้ข้อมูลร้านพื้นฐาน, และ C4 (polygon มีผลตอนรับออเดอร์)

รายละเอียดเต็ม กับดัก และงานที่เหลือของสายนี้อยู่ใน
[`docs/HANDOFF-service-area-map.md`](./HANDOFF-service-area-map.md) **บน branch นั้น**
(ไฟล์ยังไม่ได้เข้า main จึงยังไม่เห็นจาก main)

gate ที่รันจริง: unit 303/303, tsc exit 0, build 37/37,
`test:db:service-area` 14 PASS 0 FAIL บน PostGIS 3.3 ในคอนเทนเนอร์

### PR สาย security — `fix/security-hardening-phase05`

ฐานจาก `main` (`7f123df`) แยกจาก PR #4 โดยตั้งใจ ไม่มีไฟล์ทับกัน merge ก่อนหลังได้อิสระ

ที่มา: รีวิวรอบ 2026-09-14 (Claude + opencode + agent อีกตัว) เจอช่องโหว่ที่
**มีอยู่บน main มาก่อน** ไม่ได้เกิดจาก PR #4 ทุกข้อไล่ตรวจกับโค้ดจริงแล้ว ไม่ได้เชื่อตามรายงาน

| # | เรื่อง | สถานะ |
| :-- | :-- | :-- |
| 1 | RLS `orders` / `order_items` / `payments` เขียน `using (has_shop_access(...) or true)` — `or true` ทำให้ anon key อ่านชื่อ เบอร์โทร ที่อยู่ลูกค้าได้ทุกร้าน | **แก้แล้ว** `20260914000006` |
| 2 | `updateShopTelegramSettingsAction` ตรวจแค่ล็อกอิน ไม่ตรวจ `has_shop_access` ก่อนใช้ admin client (IDOR) | **แก้แล้ว** |
| 3 | `timeoutOfferAction` อยู่ในไฟล์ `'use server'` โดยไม่มีการตรวจสิทธิ์ = endpoint สาธารณะจับ advisory lock | **แก้แล้ว** ย้ายไป `src/lib/dispatch-timeout.ts` |
| 4 | `payment.ts` รับ `api_url` จากฐานข้อมูลเป็น URL อะไรก็ได้ แล้วส่ง API key ที่ถอดรหัสแล้ว + สลิปลูกค้าไปปลายทางนั้น | **แก้แล้ว** allowlist `api.slipok.com` |
| 5 | `/api/telegram/webhook` ไม่ตรวจ `x-telegram-bot-api-secret-token` | **แก้แล้ว** fail-closed |
| 6 | `impersonateStoreAction` ไม่ตรวจ superadmin ก่อนตั้ง cookie | **แก้แล้ว** (ทุกหน้าที่อ่าน cookie ตรวจซ้ำอยู่แล้ว จึงไม่เคย exploit ได้ เป็นการอุด defence-in-depth) |

**ข้อ 1 เปลี่ยนพฤติกรรมหน้าลูกค้า** หน้า `/order/[orderId]` เคยรับสถานะสดผ่าน
realtime subscription ด้วย anon key ซึ่งเป็นเหตุผลเดียวที่ RLS ต้องเปิดให้ anon
เปลี่ยนเป็น poll ผ่าน `getOrderTrackingSnapshotAction` ทุก 8 วินาทีแทน
action คืนเฉพาะ `status` / `payment.status` / `payment.method` ไม่คืนข้อมูลส่วนตัวลูกค้า

**ห้าม apply `20260914000006` ก่อน deploy โค้ดหน้า tracker ตัวใหม่**
ไม่งั้นลูกค้าจะค้างที่สถานะเดิมจนกว่าจะรีเฟรชเอง

หลักฐานที่รันจริง (2026-09-14):

```
unit               271/271 ผ่าน 0 fail (89 suites)
tsc --noEmit       exit 0
build              compile ผ่าน, static 37/37
git diff --check   exit 0
run-db.js          ทุกขั้นถึง 1.19 SUCCESS บน PostGIS 3.3 ในคอนเทนเนอร์
```

พิสูจน์ที่ระดับฐานข้อมูลจริง ไม่ใช่แค่ regex:

```
policy เดิม (or true)  anon select orders -> 1 แถว พร้อมเบอร์โทรลูกค้า
policy ใหม่            anon select orders -> 0 แถว
                       authenticated คนนอกร้าน -> 0 แถว
                       owner ของร้านนั้น       -> 1 แถว
```

เทส `test/security-hardening-phase05.test.ts` (17 เคส) รันกับ `main` ที่ยังไม่แก้
**fail 13/13** ที่รันถึง (อีก 4 เคสหยุดเพราะไฟล์ migration ยังไม่มี) ไม่ใช่เทสลอย

**ต้องตั้งค่าก่อน deploy:** `TELEGRAM_WEBHOOK_SECRET` บน Vercel และเรียก
`setWebhook` ของ Telegram ด้วย `secret_token` ค่าเดียวกัน ไม่ตั้ง = บอทตอบ 500 ทุก request
(เจตนา fail-closed ตามกฎข้อ 11 ของ handoff นี้)

### ยังไม่ได้ทำ — NOT PERFORMED ทั้งสอง PR

- ไม่ได้ apply migration ใดลง production (`20260914000003`, `000005`, `000006`)
- ไม่ได้ทดสอบ UI บนเบราว์เซอร์จริง
- ไม่ได้ทดสอบหน้า tracker ตัว poll กับออเดอร์จริง
- ไม่ได้ทดสอบ Telegram webhook หลังใส่ secret

---

## 2. ลำดับงานถัดไป

แผนที่เจ้าของโปรเจกต์อนุมัติแล้ว (2026-09-14) เรียงตามนี้

| Phase | งาน | สถานะ |
| :-- | :-- | :-- |
| 0.1 | เปิด PR #4 | **DONE** |
| 0.2 | รีวิว PR #4 (คนตรวจคนละตัวกับคนเขียน) | **DONE** ไม่มี blocker แก้ 1 ข้อแล้ว |
| 0.5 | ปิดช่องโหว่ 6 ข้อที่รีวิวเจอ | **DONE** รอ merge |
| 1 | apply `20260914000003` + ตั้ง `TELEGRAM_SUPERADMIN_CHAT_ID` + ทดสอบวงจรอนุมัติ | ยังไม่เริ่ม |
| 0.3 | UAT บนเบราว์เซอร์จริง 4 จอ | ยังไม่เริ่ม (ต้องรอ Phase 1) |
| 0.4 | merge PR #4 + deploy | ยังไม่เริ่ม |
| 2 | apply `20260914000005` (C4) เป็นรอบแยก | ยังไม่เริ่ม |
| 4.1 | แก้ PKCE/login (ดูข้อ 9) | **ยังไม่เริ่ม — บล็อก pilot** |
| 3 | pilot ร้านแรก: ปักหมุด 3 ร้านที่เหลือ, วาด polygon, เปิด `service_area_enabled` ทีละร้าน | ยังไม่เริ่ม |
| 4.2 | ทดสอบภาคสนามแม่ฮ่องสอน (Android + iPhone จริง) | ยังไม่เริ่ม |

**gate ก่อน apply C4:** ยืนยันก่อนว่า `select count(*) filter (where service_area_enabled) from public.shops` = 0
ถ้าเป็น 0 การ apply จะไม่เปลี่ยนพฤติกรรมที่สังเกตได้เลย (blast radius ศูนย์)
ถ้าไม่ใช่ 0 ต้องมีแผน rollback เต็มรูปก่อน

**ลำดับ apply migration ที่ต้องรักษา**

1. `20260914000006` (ปิดรู RLS) — **ต้อง deploy โค้ดหน้า tracker ตัวใหม่ก่อน**
2. `20260914000003` (ตารางคำขอพร้อมเพย์) — เพิ่มของใหม่ล้วน ย้อนกลับด้วยการ drop
3. `20260914000005` (C4) — รอบแยก ย้อนกลับด้วยการรัน `20260912000006` ซ้ำ

ห้าม commit, push, merge, deploy หรือแก้ production โดยไม่มีคำสั่งจากเจ้าของโปรเจกต์

## 3. งานใน PR #2

PR #2 อยู่บน branch `codex/admin-mobile-nav` และรวม:

- เมนูแอดมินรองรับมือถือ
- สถานะเปิด/ปิดร้าน
- Service Area ระยะที่ 1 แบบวงกลมจากพิกัดร้าน
- ป้องกันลูกค้านอกเขตสร้างออเดอร์ที่ชั้นฐานข้อมูล
- จับเวลาไรเดอร์ออกนอกเขตและปิด session เมื่อเกิน 15 นาที
- ให้ไรเดอร์กลับเข้าเขตแล้วเริ่มงานใหม่ได้
- GitHub Actions สำหรับ cron ภายนอก
- PostgreSQL integration test ของ Service Area
- คู่มือและเครื่องมือทดสอบภาคสนาม

### Service Area ระยะที่ 1

ทำแล้ว:

- ลูกค้านอกเขตสั่งไม่ได้
- พิกัดลูกค้าหรือร้านไม่ครบทำงานแบบ fail-closed
- ไรเดอร์ออกนอกเขตเริ่มจับ `outside_area_since`
- เกิน 15 นาที session ถูกปิดและถือว่าไม่รับงาน
- กลับเข้าเขตแล้วเริ่ม session ใหม่ได้
- Settings, GPS report และ sweep ใช้ advisory lock ชุดเดียวกัน
- RPC ตรวจ authorization และ tenant access
- cron endpoint `rider-geofence-sweep` ตรวจ `CRON_SECRET`

ไฟล์สำคัญ:

- `supabase/migrations/20260912000006_service_area_enforcement.sql`
- `src/app/admin/service-area/page.tsx`
- `src/app/admin/service-area/ServiceAreaSettingsClient.tsx`
- `src/app/api/cron/rider-geofence-sweep/route.ts`
- `src/app/actions/settings.ts`
- `src/app/rider/RiderClient.tsx`
- `test/service-area-enforcement.test.ts`
- `test/service-area-postgres.integration.cjs`

## 4. Branch ปัจจุบัน: Auth/IDOR Hardening

`fix/auth-idor-hardening` ต่อจากปลาย branch PR #2 และเพิ่ม commits:

- `0ae811d` — ปิด IDOR, guard superadmin actions, จำกัด SlipOK domain, fail-closed webhook และเพิ่มความปลอดภัย payment slips
- `ad657ac` — guard platform stats, ผูกการแก้ Telegram rider กับร้าน, ป้องกัน menu upload path และบังคับ HTTPS สำหรับ SlipOK
- `da08f4a` — ตัด UTF-8 BOM ก่อนรัน payment-slips migration

ไฟล์ที่ต่างจากปลาย branch PR #2:

- `scripts/run-db.js`
- `src/app/actions/menu.ts`
- `src/app/actions/order.ts`
- `src/app/actions/rider-admin.ts`
- `src/app/actions/settings.ts`
- `src/app/actions/superadmin.ts`
- `src/app/api/webhooks/slipok/route.ts`
- `supabase/migrations/20260913000001_secure_payment_slips_storage_policy.sql`
- `supabase/migrations/20260913000002_secure_payment_slips_upload_policy.sql`
- `test/authorization-regression.test.ts`

หลัง PR #2 merge ต้องตรวจ ancestry/diff ใหม่ก่อนเปิด PR ของ branch นี้

## 5. Service Area Map & PromptPay Approval

> รวมจาก `docs/HANDOFF-service-area-map.md` ที่เคยแยกออกไป ไฟล์นั้นถูกลบแล้ว
> เพราะผิดกฎข้อ 9 ของ AGENTS.md และเนื้อหาเริ่มขัดกันเองจริง ๆ
> (หัวไฟล์บอกว่างาน 2-5 merge แล้ว ท้ายไฟล์บอกว่ายังไม่ได้ทำ)

อยู่บน branch `feat/service-area-integration` — [PR #4](https://github.com/lannatc-sys/RAN-R-HAN/pull/4)

### สถานะ migration บน production

ตรวจสดจาก Supabase เมื่อ 2026-09-14:

| migration | apply แล้ว | ผล |
| :--- | :--- | :--- |
| `20260914000001_service_area_polygon` | **ใช่** | `shops.service_area_polygon`, `rider_work_area_polygon`, `is_point_in_shop_area`, `parse_area_polygon` |
| `20260914000002_superadmin_only_service_area` | **ใช่** | `update_shop_geo` / `set_shop_service_area_settings` เหลือ `is_superadmin` + `set_shop_service_area_polygon` |
| `20260914000004_read_shop_area_polygons` | **ใช่** | `get_shop_area_polygons` คืน polygon เป็น GeoJSON |
| `20260914000003_promptpay_change_requests` | **ยังไม่** | ตาราง + RPC คำขอเปลี่ยนพร้อมเพย์ |
| `20260914000005_enforce_polygon_service_area` | **ยังไม่** | ให้ polygon ลูกค้ามีผลตอนรับออเดอร์ (C4) |

### ทำเสร็จแล้วใน PR #4

- หน้า `/superadmin/service-area-map` วาด polygon บน Leaflet จริง เลือกร้าน ปักหมุด
  โหลดพื้นที่ที่บันทึกไว้กลับมาแก้ต่อได้ มีเทส round-trip คุมว่าเซฟ→โหลด→เซฟซ้ำรูปไม่เพี้ยน
- ล็อกช่องพร้อมเพย์ฝั่งร้าน + ปุ่มขอแก้ไข และถอด `promptpay_id`/`promptpay_name`
  ออกจาก `updateShopSettingsAction` แล้ว
- เมนู "คำขออนุมัติ" + หน้า `/superadmin/approvals` พร้อม badge จำนวนค้าง
- แผงแก้ข้อมูลร้านพื้นฐานในหน้า `/superadmin/stores` (ไม่รวม `kds_pin` และพร้อมเพย์)
- C4 — `enforce_service_area_for_new_orders` เรียก `is_point_in_shop_area` (ยังไม่ apply)
- Control เปิด/ปิด `service_area_enabled` และรัศมี fallback ฝั่ง superadmin

### ⚠️ ช่องว่างที่ยังเปิดอยู่ — polygon ของไรเดอร์ยังไม่มีผลเลย

`is_point_in_shop_area` ถูกเรียกจาก **`enforce_service_area_for_new_orders` ที่เดียว**
เส้นทางที่เหลืออีกห้าจุดใน `20260912000006` ยังเรียก `calc_distance_meters` ตรง ๆ

- `start_rider_work_session`
- `report_rider_location`
- `sweep_expired_rider_geofence_sessions`
- `set_shop_service_area_settings`
- `update_shop_geo`

แปลว่า **`shops.rider_work_area_polygon` เก็บได้แต่ไม่มีผลกับอะไรเลย**
ต้องมี migration รอบถัดไปกวาดทั้งห้าจุด โดย**ห้ามคัดลอก body มาเขียนใหม่**
(ดูกับดักข้อ 1) และต้องเพิ่ม PostGIS test เคสจุดอยู่ในรัศมีแต่นอก polygon ของไรเดอร์
สำหรับ start / report / sweep / การตั้งค่า

เจอโดยรีวิวของ Codex ก่อนหน้านี้เอกสารและคำอธิบาย PR เขียนผิดว่าใช้ predicate ร่วมกันแล้ว

### งานที่เหลือ เรียงตามที่ควรทำ

1. apply `20260914000003` แล้วตั้ง `TELEGRAM_SUPERADMIN_CHAT_ID`
2. UAT บนเบราว์เซอร์จริงทั้งสี่จอ
3. merge PR #4 แล้ว deploy
4. apply `20260914000005` เป็นรอบแยก — ก่อน apply ต้องยืนยัน
   `select count(*) filter (where service_area_enabled) from public.shops` = 0
   ถ้าเป็น 0 การ apply จะไม่เปลี่ยนพฤติกรรมที่สังเกตได้เลย
5. กวาดห้าจุดที่เหลือให้ใช้ `is_point_in_shop_area` (ช่องว่างข้างบน)

### กับดักที่เสียเวลาไปแล้ว อย่าเหยียบซ้ำ

1. **ห้ามคัดลอก body ของ RPC มาเขียนใหม่** `update_shop_geo` และ
   `set_shop_service_area_settings` มี advisory lock, row lock และลูปเรียงตาม
   `rider_id` กันเดดล็อก การเขียนใหม่จากที่เห็นบางส่วนทำตกไปแล้วครั้งหนึ่ง
   วิธีที่ใช้จริงคือให้ migration อ่าน `pg_get_functiondef` แล้วแทนที่เฉพาะ
   บรรทัดตรวจสิทธิ์ และ raise ถ้าหาไม่เจอ
2. **`audit_logs` ใช้ชื่อคอลัมน์ `user_id` และ `details`** ไม่ใช่ `actor_id` / `detail`
   และ `entity_type` เป็น NOT NULL
3. **ห้าม `settings.ts` คืน `error.message` ดิบ** ต้องแปลเป็นข้อความคงที่ก่อนส่งกลับ client
   เทส `authorization-regression` จับได้จริงมาแล้ว
4. **Superadmin เป็นธีมสว่าง ไม่ใช่ธีมมืด** `bg-slate-100/70` พร้อมไซด์บาร์มืด
   ห้ามใส่คลาส `dark` ที่ตัวครอบ และหน้า superadmin อื่นใช้ `dark:` เป็นศูนย์ทุกไฟล์
5. **ทิศวงแหวน polygon ไม่ทำให้พื้นที่กลับด้าน** ทดสอบกับ PostGIS 3.3.7 แล้ว
   `ST_Covers` ตอบเหมือนกันทั้งตามเข็มและทวนเข็ม `toCounterClockwise` เก็บไว้
   เพราะ RFC 7946 ไม่ใช่เพราะกันบั๊ก
6. **isolation gate จับ import ไม่ใช่คำในไฟล์** `revalidatePath('/superadmin/service-area-map')`
   เคยทำให้เทสแดงมาแล้ว ตอนนี้แก้ให้จับเฉพาะ import จริง
7. **เลขพร้อมเพย์อาจเป็นเลขบัตรประชาชน** เป็นข้อมูลส่วนบุคคลตาม PDPA
   ห้ามส่งเต็มเข้า Telegram ใช้ `maskDigits` เลขเต็มแสดงได้เฉพาะหน้า `/superadmin/approvals`
8. **`shell` ของ editor default เป็น `DEMO_INITIAL_EDITOR_STATE`** ถ้า mount โดยไม่ส่ง
   `initialState` หน้าจริงจะขึ้นรูปสาธิตแล้วปุ่มบันทึกของจริงเขียนทับพื้นที่ร้านได้
   หน้า production ต้องส่ง `mode="live"` และ mount เฉพาะตอนโหลดสำเร็จ
9. **`test:unit` กับ `test` ใน `package.json` เป็นคนละรายการ** CI รัน `pnpm test`
   เทสที่เพิ่มเข้าแต่ `test:unit` จะไม่ถูกรันใน CI เลย มีเทสคุมให้สองรายการตรงกันแล้ว

### ข้อมูลจริงที่ควรรู้

- ร้านทั้งหมด 4 ร้าน ปักหมุดแล้วเพียง 1 ร้าน (ครัวป้าแดง `19.3005, 97.9678`)
- **ยังไม่มีร้านใดเปิด `service_area_enabled`** เส้นทางบังคับใช้พื้นที่จึงยังไม่เคย
  ทำงานจริงบน production สักครั้ง
- `TELEGRAM_SUPERADMIN_CHAT_ID` ยังไม่ได้ตั้ง การแจ้งเตือนจะถูกข้ามอย่างเงียบ ๆ

### วิธีย้อนกลับ

- สิทธิ์เจ้าของร้าน: เปลี่ยน `is_superadmin()` กลับเป็น `has_shop_access(p_shop_id)`
  ในสองฟังก์ชัน แล้วตั้ง `SHOP_CAN_EDIT_SERVICE_AREA` / `SHOP_CAN_EDIT_LOCATION` เป็น `true`
- polygon: คอลัมน์และฟังก์ชันเพิ่มเข้ามาเฉย ๆ ลบได้ถ้าต้องการ
- C4: รัน `20260912000006` ซ้ำ enforce function จะกลับไปวัดระยะแบบเดิม
- คำขอพร้อมเพย์: drop ตารางและ RPC ได้ ไม่มีใครพึ่งพานอกจากหน้า approvals

## 6. หลักฐานคุณภาพล่าสุด

ผลตรวจและรันจริงบนเครื่องปัจจุบันหลังย้าย SSD กลับมา (2026-09-13 16:11 Asia/Bangkok):

| Gate | ผลล่าสุดที่บันทึกไว้ | หมายเหตุ |
| --- | --- | --- |
| Unit tests | 254/254 ผ่าน (83 suites) | `pnpm test:unit` ผ่านทั้งหมด 100% |
| Smoke tests | 4/4 ผ่าน | `pnpm test:smoke` (AES, Thai Error, Zod, PromptPay) |
| E2E tests (Live Supabase) | 4/4 ผ่าน | `pnpm test:e2e` ทดสอบ PromptPay, Cash, Price isolation, 23505 duplicate slip |
| TypeScript (`tsc --noEmit`) | ผ่าน (Exit 0) | ไม่มีข้อผิดพลาดทาง type |
| `git diff --check` | ผ่าน (Exit 0) | ไม่มี whitespace conflict |
| Production build | 51/51 routes ผ่าน | `pnpm build` (Next.js 15.5.25) compile และ static generation สำเร็จสมบูรณ์ |
| PostgreSQL integration | Standby | รอ run ผ่าน Docker บน WSL2 (`OpenClawGateway`) หรือกำหนด `TEST_DATABASE_URL` |

คำสั่งหลัก:

```powershell
pnpm test:unit
pnpm test:smoke
pnpm test:e2e
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

## 7. สภาพแวดล้อมหลังย้าย SSD กลับเครื่องเดิม

บันทึกการตรวจสอบและปรับสภาพแวดล้อมเมื่อย้าย SSD กลับมาเครื่องที่เคยติดตั้งโปรเจกต์ (2026-09-13):

1. **Runtime & Package Manager**:
   - Node.js: `v24.19.0` (ผ่านเกณฑ์ Next.js 15)
   - pnpm: `9.15.9` (ตรงกับ `packageManager` ใน `package.json`)
   - `node_modules` และ binaries ทำงานร่วมกับสภาพแวดล้อมปัจจุบันได้สมบูรณ์ ไม่พบ native artifact mismatch

2. **Git & Repository Configuration**:
   - Working Directory: `D:\system make\Ran-R-HAN`
   - Active Branch: `fix/auth-idor-hardening`
   - Remote URL: `https://github.com/lannatc-sys/RAN-R-HAN.git`
   - Git User Profile: `Tanutcha Seemrnee` (`316379503+gamerx-99@users.noreply.github.com`)
   - Credential Helper: `manager` (Git Credential Manager)

3. **Database & External Services**:
   - Cloud Supabase: เชื่อมต่อสำเร็จและยืนยันผ่าน E2E test (`https://hqfzahyvwsjrvlgvaxda.supabase.co`)
   - Local Docker/Postgres: บน Windows host ไม่มีคำสั่ง `docker` ใน PATH โดยตรง แต่มี Docker 29.1.3 รันอยู่ใน WSL2 (`OpenClawGateway`) สามารถเรียกใช้สำหรับ local integration test ได้ผ่าน `wsl -d OpenClawGateway`
   - Network Ports: Port `3000` ว่าง พร้อมรัน `pnpm dev` ได้ทันที

4. **สถานะความพร้อมของโค้ด**:
   - ผ่านการคอมไพล์ Production build ครบทุก Route (51 routes)
   - ผ่าน Unit tests และ E2E tests ร่วมกับฐานข้อมูลหลักครบถ้วน

5. **Git Worktree Isolation**:
   - ตั้งค่าโครงสร้าง Git Worktree รองรับการทำงานคู่ขนานของ Agent/Antigravity โดยจัดสรรไดเรกทอรี `.worktrees/` (และ `.agents/worktrees/`)
   - เพิ่ม `.worktrees/`, `.agents/worktrees/`, `.claude/worktrees/` ใน `.gitignore` และ `.git/info/exclude` เพื่อป้องกันไม่ให้โค้ดใน worktree หลุดเข้ามาใน git index
   - สามารถสร้าง isolated worktree สำหรับงานใหม่ด้วยคำสั่ง: `git worktree add .worktrees/<branch-name> -b <branch-name>` ตาม skill `using-git-worktrees` ได้ทันที

## 8. Production gates ที่ยังไม่ปิด

ก่อน PR #2 deploy เคยตรวจได้:

```text
/api/cron/dispatch-timeout      401 — endpoint มีอยู่และ fail-closed
/api/cron/data-retention        401 — endpoint มีอยู่และ fail-closed
/api/cron/rider-geofence-sweep  404 — ยังไม่ deploy
```

หลัง merge/deploy ต้องตรวจใหม่:

- ไม่มี `Authorization` → 401
- secret ผิด → 401
- secret ถูก → 200
- GitHub Actions มี run ที่ trigger จาก `schedule` จริง ไม่ใช่เพียง `workflow_dispatch`
- `CRON_SECRET` ของ GitHub และ Vercel ตรงกัน

ยัง **NOT VERIFIED** บนมือถือจริงในแม่ฮ่องสอนสำหรับ Background GPS, Web Push และวงจรรับงานไรเดอร์

## 9. PKCE/Login

Production Google OAuth ส่ง callback กลับ `https://ran-r-han.vercel.app/auth/callback` ถูกต้อง และการทดสอบใน browser context เดียวกันพบว่า verifier ไปถึง callback

Error `PKCE code verifier not found in storage` มีแนวโน้มเกิดเมื่อ callback เปิดคนละ storage context เช่น:

- เริ่มใน LINE/Gmail in-app browser แต่ callback เปิด Chrome
- เปิดลิงก์ยืนยันอีเมลอีก browser หรืออีก device
- เปิด callback URL เก่าซ้ำ หรือ cookie ถูกล้าง

สถานะ: **NOT FIXED** ต้องแยกก่อนว่าเกิดจาก Google OAuth หรือ email confirmation:

- Google OAuth: รักษา browser/origin เดียวกัน, อัปเดต `@supabase/ssr` อย่างระมัดระวัง และพิจารณา PKCE flow ID
- Email confirmation: พิจารณา `/auth/confirm` แบบ `token_hash + verifyOtp`

ห้ามแสดง raw Supabase error ต่อผู้ใช้ ให้ map เป็นข้อความภาษาไทยและเริ่ม flow ใหม่

## 10. งานที่พักไว้

ระบบตรวจสอบชื่อบัญชี/เจ้าของร้านและ Telegram admin review ถูกพักจนกว่าระบบหลักพร้อม

แนวคิดที่ตกลงไว้แต่ยังไม่เริ่ม:

- ร้านกรอกข้อมูลยืนยันแล้วเข้าสถานะ `pending_admin_review`
- Telegram ส่งข้อมูลปิดบังและลิงก์หน้าเว็บให้แอดมิน
- แอดมินดูข้อมูลเต็มและอนุมัติผ่านหน้าเว็บที่ล็อกอินแล้ว
- แก้ข้อมูลภายหลังแล้วกลับเป็น pending
- ไม่ส่งเลขเต็มผ่าน Telegram, URL หรือ logs

## 11. ข้อควรระวัง

- ห้ามพิมพ์ secret, token, API key หรือข้อมูลส่วนบุคคลเต็มลง console/handoff
- `CRON_SECRET` เคยปรากฏในไฟล์ทำงานภายในและถูก scrub แล้ว ควรพิจารณาหมุนก่อน pilot
- การซ่อนเมนูไม่ใช่ authorization ต้องบังคับที่ server/RPC/RLS
- Payment, SlipOK, Telegram และ cron ต้อง fail-closed เมื่อ config ไม่ครบ
- ห้ามใช้ service-role client ในเส้นทางผู้ใช้โดยไม่มี authorization check ที่ชัดเจน
- ห้ามสร้างหรือลบข้อมูลทดสอบบน production

## 12. วิธีรับช่วงงานแบบประหยัด context

AI ตัวถัดไป:

1. อ่านไฟล์นี้ครั้งเดียว
2. รัน `git status --short`, `git branch --show-current` และ `git log -5 --oneline`
3. เทียบเฉพาะ commits/diff หลังสถานะล่าสุด
4. เปิดเฉพาะไฟล์ที่เปลี่ยน ไม่รีวิวทั้ง repository ใหม่
5. รัน targeted checks ก่อนและบันทึกผลจริงพร้อมเวลา
6. ก่อนหยุด ให้อัปเดตไฟล์นี้โดยไม่สร้าง handoff เพิ่ม

ใช้สถานะเพียง:

- `DONE` — ทำเสร็จและมีหลักฐาน
- `PARTIAL` — ทำบางส่วน
- `BLOCKED` — ไปต่อไม่ได้เพราะ dependency/authority/environment
- `NOT VERIFIED` — ยังไม่ได้ทดสอบจริง

---

## 13. รอบ 2026-09-15 — Staging Infrastructure Preparation (Claude)

ขอบเขตรอบนี้ **เฉพาะ infrastructure** ไม่แตะ Telegram implementation, Core Flow business logic,
Service Area หรือ Rider Monitor เลยสักไฟล์ ไม่มี source code เปลี่ยน มีแค่ไฟล์นี้ไฟล์เดียว

### 13.1 Supabase staging — DONE

| รายการ | ค่า |
| --- | --- |
| project ref | `uorbgwnedirqtwphzcaj` (name `RAN-R-HAN-staging`) |
| org | `SAMMORKCODEING` (`lsxzpbrckmjmscilsmle`) — org เดียวกับ production |
| region | `ap-northeast-1` ตรงกับ production |
| ค่าใช้จ่าย | $0/เดือน (free tier) |
| API URL | `https://uorbgwnedirqtwphzcaj.supabase.co` |

production project `hqfzahyvwsjrvlgvaxda` **ไม่ถูกแตะ** ทำแค่ `list_projects` อ่านอย่างเดียว

### 13.2 Migration chain — DONE (รันจริง ไม่ใช่ regex)

รัน `node scripts/run-db.js` ด้วย staging `DATABASE_URL` — **24/24 ขั้น SUCCESS, 0 error, 0 skip**
ตั้งแต่ `run_all.sql` ถึง `20260914000006_tighten_customer_data_rls.sql`

ตรวจซ้ำผ่าน Supabase API: **31 ตาราง ใน `public`, RLS เปิดครบทั้ง 31 ตาราง**
`delivery_locations` มี 7 แถว (default ของ migration) ที่เหลือ 0 แถวก่อนใส่ test fixtures

> **กับดักที่เจอ:** connection string แบบ direct (`db.<ref>.supabase.co`) resolve ไม่ได้บนเครื่องนี้
> (`getaddrinfo ENOENT` — IPv6-only) ต้องใช้ **session pooler `aws-0-ap-northeast-1.pooler.supabase.com:5432`**
> ทั้งในเครื่องและบน Vercel ทดสอบแล้ว `aws-0:5432` ต่อติด

`get_advisors security` บน staging: **0 ERROR** มีแต่ WARN เชิงโครงสร้าง 3 กลุ่ม
(SECURITY DEFINER function เรียกได้จาก `anon` 13 ตัว / จาก `authenticated` 24 ตัว,
leaked-password protection ปิดอยู่) ทั้งหมดมาจาก migration chain เอง ไม่ใช่ของใหม่ที่รอบนี้สร้าง
production ก็จะขึ้นชุดเดียวกัน — **ยังไม่ได้ตรวจเทียบกับ production advisors: NOT VERIFIED**

### 13.3 Vercel Preview → staging — DONE

branch ที่ใช้: **`feat/telegram-operational-gateway`** (tip `ba0ee71`)
ยืนยัน `git merge-base --is-ancestor 8f9e0de ba0ee71` = YES ไม่ย้อนกลับเก่ากว่า `8f9e0de`

**วิธีที่ใช้ และเหตุผล:** env ของเดิมทุกตัวเป็น record เดียวที่ผูก `Preview, Production` พร้อมกัน
`vercel env rm <name> preview` จึงเสี่ยงลบ record ที่ production ใช้อยู่
เลยใช้ **branch-scoped Preview env** ทั้งหมด (16 ตัว) ซึ่งเป็น record แยกและ override เฉพาะ branch นี้
record เดิมไม่ถูกแตะสักตัว ตรวจหลังทำแล้วว่า `DATABASE_URL (Preview, Production)` ยังอยู่ครบ

| กลุ่ม | ตัวแปร |
| --- | --- |
| Supabase staging | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` |
| generate ใหม่เฉพาะ staging | `CREDENTIALS_ENCRYPTION_KEY`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `SLIPOK_WEBHOOK_SECRET`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` |
| test superadmin | `SUPER_ADMIN_USER`, `SUPER_ADMIN` |

ไม่มีตัวไหน reuse ค่าจาก production ทั้งหมดใส่ผ่าน stdin ไม่เคย print ค่าออกมา

`SUPABASE_SERVICE_ROLE_KEY` ใส่เป็นค่า `sb_secret_…` ของ staging ตามที่
[`src/lib/supabase/admin.ts:12-18`](../src/lib/supabase/admin.ts) รองรับ (`SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY`
และข้อความ error บอกให้ก๊อป secret key มาใส่) staging project ใหม่ไม่ได้เปิด legacy JWT service_role ไว้

### 13.4 ⚠️ landmine ที่เจอระหว่างทาง — ยังไม่แก้ (นอกขอบเขตรอบนี้)

[`src/lib/supabase/admin.ts:8-11`](../src/lib/supabase/admin.ts) มี **hardcoded production URL เป็น fallback**

```ts
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://hqfzahyvwsjrvlgvaxda.supabase.co';   // ← fallback ไป production
```

รอบนี้ตั้ง env ครบทั้งสองตัวจึงไม่ทำงาน แต่ถ้า env หลุดหายเมื่อไหร่
**admin client ของ staging จะเงียบ ๆ ไปเขียน production ด้วย service-role key** ควรเปลี่ยนเป็น throw

### 13.5 Test fixtures บน staging — DONE

สร้างผ่าน Supabase Auth Admin API (`email_confirm: true` ทั้งคู่ ล็อกอินได้ทันที ไม่ต้องยืนยันเมล)
รหัสผ่านอยู่ใน `.env.staging.generated` บนเครื่อง (gitignored) **ไม่ได้เขียนลงเอกสารนี้**

| อีเมล | `users.role` | shop | rider |
| --- | --- | --- | --- |
| `staging-superadmin@example.com` | `superadmin` | – | – |
| `staging-shoprider@example.com` | `owner` | `staging-test-shop` | มี `riders` row, status `active` |

`staging-shoprider@example.com` = user คนเดียวที่มี **ทั้ง Shop และ Rider** ตามที่ขอ
(`public.users.shop_id` ชี้ร้าน และ `public.riders.auth_user_id` ชี้ auth user เดียวกัน)

ร้าน `staging-test-shop`: `is_open=true`, `allow_delivery=true`, `is_delivery_enabled=true`,
`shop_lat/lng = 18.7883 / 98.9853` (เชียงใหม่), `service_area_enabled` = **false ตาม default**
— ตั้งใจไม่เปิด geofence เพื่อไม่ให้บล็อก E2E รอบแรก ถ้า Muse ต้องทดสอบ service area ให้เปิดเอง

### 13.6 พิสูจน์ว่า Preview ชี้ staging จริง — DONE

preview URL: `https://ran-r-han-git-feat-telegram-operational-gateway-maehongson.vercel.app`

**ก่อน** ตั้ง env — grep JS chunk ที่ build แล้ว: `1 × hqfzahyvwsjrvlgvaxda.supabase.co`
**หลัง** ตั้ง env + redeploy: `2 × uorbgwnedirqtwphzcaj.supabase.co`, **0 × hqfzahyvwsjrvlgvaxda**

พิสูจน์ฝั่ง server ด้วย slug ที่มีอยู่เฉพาะใน staging:

```
PREVIEW  /staging-test-shop -> HTTP 200  (render ชื่อ "Staging Test Shop")
PROD     /staging-test-shop -> HTTP 404
```

client bundle และ server render ชี้ staging ทั้งคู่

### 13.7 Production changes = NONE

- Supabase `hqfzahyvwsjrvlgvaxda`: อ่านอย่างเดียว ไม่มี migration/DDL/DML
- Vercel production deployment ล่าสุดยังเป็นตัวเดิมอายุ 11 ชม. (เกิดก่อนงานรอบนี้) ไม่มี deploy ใหม่
- `ran-r-han.vercel.app` ยัง HTTP 200 และ bundle ยังชี้ `hqfzahyvwsjrvlgvaxda`
- Vercel env record ที่ผูก `Preview, Production` ไม่ถูกแก้/ลบสักตัว
- ไม่ได้ `setWebhook` production ไม่ได้ตั้ง `TELEGRAM_BOT_TOKEN` บน Preview

### 13.8 ส่งต่อให้ Muse — Telegram E2E checklist J

พร้อมแล้ว: staging DB + preview + test users
ยังไม่ทำ (เจตนา ปล่อยให้ Muse ตัดสินใจ):

- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_SUPERADMIN_CHAT_ID` บน Preview — **ยังไม่ตั้ง**
  แปลว่า preview ยิง Telegram production ไม่ได้ ตั้งใจกันพลาด
- `TELEGRAM_WEBHOOK_SECRET` ของ staging ตั้งไว้แล้ว (ค่าใหม่) อยู่ใน `.env.staging.generated`
- `setWebhook` — **NOT PERFORMED** เป็นงานของ Muse

**BLOCKED / ข้อจำกัดที่ต้องรู้:**

- **Google OAuth ใช้ไม่ได้บน preview** — `GOOGLE_Client_*` ยัง inherit ของ production ซึ่งตั้ง callback ไว้ที่
  production Supabase มติรอบนี้คือ SKIP ให้ E2E ใช้ email/password แทน
- `SUPABASE_ANON_KEY` (ไม่มี prefix `NEXT_PUBLIC_`) — **ตรวจแล้ว ไม่ใช่ปัญหา** ใช้ที่เดียวคือ
  [`src/lib/supabase/server.ts:14`](../src/lib/supabase/server.ts) เป็น fallback **ลำดับที่สาม**
  ต่อจาก `NEXT_PUBLIC_SUPABASE_ANON_KEY` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  ซึ่งตั้ง branch-scoped ไว้ครบแล้ว จึงไม่มีทางถูกใช้บน preview

### 13.9 Quality gates รอบนี้ — รันจริงที่ commit `ba0ee71` ตัวที่ deploy อยู่

รันใน worktree แยกแบบ detached ที่ `ba0ee71` (ตาม AGENTS.md ข้อ 1 — ไม่รันกับ tree ที่เก่ากว่าโค้ดที่ deploy)
`pnpm install --frozen-lockfile` ใหม่ทั้งชุด เสร็จแล้วลบ worktree และคอนเทนเนอร์ทิ้ง

| gate | ผล |
| --- | --- |
| `pnpm test:unit` | **462 pass / 0 fail / 0 skip**, 144 suites, 14.9s |
| `npx tsc --noEmit` | **exit 0** |
| `pnpm build` | **exit 0**, compiled successfully 46s, static pages **38/38** |
| `pnpm test:db:service-area` | **23 PASS / 0 FAIL**, exit 0 บน PostGIS 3.3 |

`test:db:service-area` รันกับคอนเทนเนอร์ `postgis/postgis:15-3.3` (ฐานข้อมูลใช้แล้วทิ้งชื่อ `ranrhan_test`)
ตามลำดับ: `test/supabase-shim.sql` → `scripts/run-db.js` (32 SUCCESS, 0 error) → integration test
**ไม่ได้รันกับ staging** เพราะเทสต์ใส่ fixture UUID ตายตัว ไม่อยากให้ปนกับข้อมูลที่ Muse จะใช้ E2E

> **เจอระหว่างทาง:** `scripts/run-db.js` **รันซ้ำบนฐานข้อมูลที่ migrate แล้วไม่ผ่าน**
> ตายที่ `MIGRATION_PATTERN_COUNT_MISMATCH: ข้อความที่ 2 ต้องเจอพอดี 1 ครั้ง`
> (self-check ในไฟล์ migration นับ pattern ซ้ำหลัง `create or replace` รอบสอง)
> staging รันไปรอบเดียวจึงไม่โดน แต่ **อย่ารัน `db:setup` ซ้ำบน staging** ถ้าไม่ได้ตั้งใจ

### 13.10 landmine เพิ่มเติม — กวาดทั้ง repo ตาม AGENTS.md ข้อ 4

ไม่ได้มีแค่ `admin.ts` ไฟล์เดียวอย่างที่รายงานตอนแรก กวาดด้วย
`grep -rn "hqfzahyvwsjrvlgvaxda\|sb_publishable_HLIHXc9dap3u"` เจอ **6 จุดใน 4 ไฟล์**

| ไฟล์:บรรทัด | ค่า hardcode |
| --- | --- |
| `src/lib/supabase/admin.ts:11` | production URL |
| `src/lib/supabase/client.ts:6` | production URL |
| `src/lib/supabase/client.ts:10` | production publishable key |
| `src/lib/supabase/server.ts:10` | production URL |
| `src/lib/supabase/server.ts:15` | production publishable key |
| `scripts/seed-demo-shops.js:32` | production storage CDN URL |

ทั้งหมดเป็น fallback ท้ายสุดเมื่อ env ว่าง รอบนี้ตั้ง env ครบจึงไม่ทำงาน
แต่ถ้า env หลุดเมื่อไหร่ โค้ดจะ **เงียบ ๆ วิ่งไป production** แทนที่จะพัง — ที่อันตรายสุดคือ `admin.ts`
เพราะคู่กับ service-role key **ยังไม่แก้รอบนี้ เป็นงานนอกขอบเขต** ควรเปลี่ยนเป็น throw ทั้งชุด

**ยังไม่ได้ตรวจ (NOT VERIFIED):** ไม่ได้เทียบ `get_advisors` ของ staging กับ production
เพราะกฎรอบนี้คือห้ามแตะ production เหตุผลที่เชื่อว่า WARN ชุดนั้นไม่ใช่ของใหม่คือ
function ที่ถูกเตือนทั้งหมดถูกนิยามใน migration chain เดียวกันที่ production ก็รันไปแล้ว
