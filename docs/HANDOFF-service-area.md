# 🗺️ Handoff — Service Area Enforcement

> **As of:** 2026-09-13 10:00 (+07) — P1 Runtime Verification ปิดแล้ว
> **เขียนโดย:** Claude session `service-area-enforcement-audit-c08db0`
> **ขอบเขตเอกสาร:** เฉพาะงาน Service Area Enforcement เท่านั้น ไม่ครอบคลุมงานอื่นใน `docs/HANDOFF.md`
>
> ⚠️ **กติกาของเอกสารนี้:** ทุกบรรทัดต้องตรวจสอบย้อนได้จากโค้ดหรือคำสั่งที่รันจริง
> ห้ามเขียนผลทดสอบที่ไม่ได้รัน ห้ามเขียนสถานะ production ที่ไม่ได้ยืนยัน
> ถ้าไม่ได้ตรวจ ให้เขียนว่า **NOT PERFORMED** ตรง ๆ

---

## 1. โค้ดอยู่ที่ไหน (อ่านก่อนเริ่มงาน)

งาน Service Area **ไม่ได้อยู่ใน worktree ใด ๆ** อยู่ใน checkout หลักเท่านั้น:

| | |
| :--- | :--- |
| **Path** | `D:\system make\Ran-R-HAN` |
| **Branch** | `codex/admin-mobile-nav` |
| **Base commit** | `5d04bdf` |
| **สถานะ** | **ยังไม่ commit** ทั้งหมดเป็น working-tree changes |

> 💡 **บทเรียนจาก session ก่อน — อย่าทำซ้ำ**
> session นั้นถูกสร้างเป็น worktree แยก (`.claude/worktrees/service-area-enforcement-audit-c08db0` อยู่ที่ `6d42a19`
> ซึ่ง **diverged** จาก `5d04bdf`) ทำให้ `git status` ขึ้นว่าสะอาดและมองไม่เห็นงาน Service Area เลยสักไฟล์
> จน build/test ที่รันไปทั้งหมด**ไม่มีน้ำหนักเป็นหลักฐาน**
> แม้จะ grant สิทธิ์โฟลเดอร์แล้ว **Edit/Write tool ก็ยังถูก guardrail บล็อก** (Bash เขียนได้ แต่ tool เขียนไม่ได้)
> **ให้เปิด session ใน `D:\system make\Ran-R-HAN` ตรง ๆ เท่านั้น**

### ไฟล์ใหม่ (untracked)

```
supabase/migrations/20260912000006_service_area_enforcement.sql   (809 บรรทัด)
src/app/admin/service-area/page.tsx
src/app/admin/service-area/ServiceAreaSettingsClient.tsx
src/app/api/cron/rider-geofence-sweep/route.ts                    (62 บรรทัด)
.github/workflows/cron-rider-geofence-sweep.yml
test/service-area-enforcement.test.ts
test/authorization-regression.test.ts
```

### ไฟล์เดิมที่ถูกแก้ (tracked, modified)

```
src/app/actions/settings.ts          ← updateServiceAreaSettingsAction
src/lib/thai-errors.ts               ← ข้อความ OUTSIDE_SERVICE_AREA / OUTSIDE_WORK_AREA
src/lib/types.ts                     ← Shop
src/app/rider/RiderClient.tsx        ← แบนเนอร์เตือน + auto-close
src/app/api/rider/session/start/route.ts
src/app/api/rider/location/route.ts
```

> ✅ `src/components/admin/AdminNavbar.tsx` **เป็นงาน Service Area ด้วย** — เพิ่มลิงก์เมนู `/admin/service-area`
> ถ้าไม่เอาเข้า commit หน้าจะเข้าไม่ถึง (เอกสารรุ่นก่อนเคยระบุผิดว่าเป็นงาน admin-mobile-nav)

---

## 2. สถานะเทียบกับ requirement

Requirement ต้นทางจากเจ้าของงาน:

> สร้างฟังก์ชั่นของ superadmin page ตั้งค่าขอบเขตการให้บริการและการทำงาน **โดยสร้างขอบเขตมาร์คบนแผนที่ได้เลย**
> 1. ลูกค้านอกเขต สั่งอาหารไม่ได้ + แจ้งเตือน
> 2. ไรเดอร์นอกเขตเกิน 15 นาที ระบบปิดการทำงาน กลับเข้าเขตแล้วกดเริ่มงานใหม่ได้

| # | รายการ | สถานะ | หลักฐาน |
| :-- | :--- | :---: | :--- |
| 1 | ลูกค้านอกเขตสั่งไม่ได้ | ✅ **ทำแล้ว** | DB trigger `trg_enforce_service_area_for_new_orders` (migration บรรทัด 275-276) บังคับที่ชั้น DB |
| 2 | ข้อความแจ้งลูกค้า | ✅ **ตรง spec** | `thai-errors.ts:52` → `อยู่นอกเขตบริการ กรุณารอแผนการขยายการให้บริการ` |
| 3 | ไรเดอร์นอกเขต 15 นาที → ปิดงาน | ✅ **ทำแล้ว** | บังคับ 3 จุด: `report_rider_location` (บรรทัด 581), sweep query (621), sweep re-check หลัง lock (657) |
| 4 | กลับเข้าเขตแล้วกดเริ่มงานใหม่ | ✅ **ทำแล้ว** | `start_rider_work_session` เช็คเขตก่อนเปิด session ใหม่ (445-450) |
| 5 | ข้อความเตือนไรเดอร์ | ✅ **ตรงเป๊ะ** | `RiderClient.tsx:530` ตรงทุกตัวอักษรกับ spec |
| 6 | **มาร์คขอบเขตบนแผนที่** | ❌ **ยังไม่ทำ** | `ServiceAreaSettingsClient.tsx` มีแค่ `<input type="number">` 2 ช่อง **ไม่มีแผนที่ในไฟล์เลย** |

**สรุป: ข้อ 1 และ 2 เสร็จและคุณภาพดี แต่ requirement หลัก (ข้อ 6) ยังไม่ได้ทำ**

---

## 3. ช่องว่างที่เหลือ — ขอบเขตบนแผนที่

### ปัญหา

ที่ทำมาเป็น **วงกลมจากพิกัดร้าน** (`service_radius_m`, `rider_work_radius_m` เก็บเป็นตัวเลขเมตร)
ไม่ใช่รูปที่วาดเอง วงกลมวาดตามถนน แม่น้ำ หรือเขตตำบลจริงไม่ได้

เจ้าของงานระบุวิธีใช้งานที่ต้องการไว้ชัด: **คลิกมาร์คทีละจุด จนวนกลับมาปิดที่จุดแรก**

### ของที่มีอยู่แล้ว ไม่ต้องลงใหม่

- `leaflet@^1.9.4` + `@types/leaflet` — **ติดตั้งแล้ว** ใน `package.json`
- `src/components/admin/delivery/DeliveryLeafletMap.tsx` — มี pattern ครบ (dynamic `import('leaflet')`, OSM tiles, SSR guard) ก๊อปโครงได้เลย
- PostGIS — เปิดใช้อยู่แล้วใน schema `extensions` (`st_distance`, `st_makepoint`, `st_setsrid`)

### แผนที่ตกลงกันไว้ (ยังไม่ได้ลงมือ)

**DB**

1. เพิ่มคอลัมน์ `service_area_polygon` และ `rider_work_area_polygon` เป็น `extensions.geography(Polygon, 4326)`
2. เพิ่มฟังก์ชันกลางตัวเดียว `is_point_in_shop_area(polygon, center_lat, center_lng, radius_m, lat, lng)`
   - มี polygon → `ST_Covers`
   - ไม่มี → ใช้รัศมีเดิม (ของเก่าที่เทสต์แล้วไม่ต้องรื้อ)
   - พิกัดเป็น NULL → **return false เสมอ (fail closed)**
3. สลับ **ทั้ง 6 จุด** ที่เทียบรัศมีให้เรียกฟังก์ชันกลาง:

   | จุด | บรรทัด | ใช้กับ |
   | :--- | :---: | :--- |
   | `enforce_service_area_for_new_orders` | 263 | ลูกค้า |
   | `start_rider_work_session` | 447 | ไรเดอร์ |
   | `report_rider_location` | 548 | ไรเดอร์ |
   | `sweep_expired_rider_geofence_sessions` | 649 | ไรเดอร์ |
   | `update_shop_geo` | 786 | ไรเดอร์ |
   | `set_shop_service_area_settings` | 196 | ไรเดอร์ |

   > ⚠️ อย่าเขียน logic polygon ซ้ำ 6 ที่ ถ้าแก้ไม่ครบทุกจุดจะเกิดช่องโหว่ที่บางเส้นทางยังใช้วงกลมอยู่

4. `set_shop_service_area_settings` รับ GeoJSON เพิ่ม 2 พารามิเตอร์ + validate:
   `ST_IsValid`, ต้องเป็น `ST_Polygon`, จุดไม่ซ้ำ ≥ 3 (npoints ≥ 4 รวมจุดปิด), จำกัดพื้นที่ไม่เกินเพดานเดียวกับรัศมี 200 กม.
   - เปลี่ยน signature แล้วต้อง `drop` ตัว 4 อาร์กิวเมนต์เดิม ไม่งั้น overload ชนกัน
   - แก้ `revoke`/`grant` ให้ตรง signature ใหม่ (บรรทัด 217-220)

**UI**

5. สร้าง `ServiceAreaMapEditor.tsx` — Leaflet คลิกทีละจุด คลิกจุดแรกเพื่อปิดรูป
   - ใช้ `circleMarker` เป็นหมุด **ไม่ต้องใช้ไอคอนจาก CDN** (เลี่ยง unpkg dependency ที่ `DeliveryLeafletMap` ใช้อยู่)
   - tile URL อ่านจาก env: มี `NEXT_PUBLIC_MAPBOX_TOKEN` → Mapbox, ไม่มี → OSM (ฟรี)
   - แผนที่เดียว สลับแก้ได้ 2 polygon (เขตลูกค้า / เขตไรเดอร์)
6. ต่อเข้า `ServiceAreaSettingsClient.tsx` โดย**คงช่องรัศมีไว้** เป็น fallback
7. `updateServiceAreaSettingsAction` + zod รับ polygon เพิ่ม, อัปเดต type `Shop`

### เรื่องค่าใช้จ่าย Mapbox

เจ้าของงานบอกเกณฑ์คือ **ประหยัดค่าใช้จ่าย**
OSM tiles ที่โปรเจกต์ใช้อยู่แล้วใน `DeliveryLeafletMap.tsx` **ฟรี** และเพียงพอสำหรับหน้า admin ที่ใช้งานไม่บ่อย
ทำเป็น env-driven ไว้ ถ้าอยากสลับไป Mapbox ภายหลังไม่ต้องแก้โค้ด

---

## 4. สถานะการตรวจสอบ

รันจริงใน `D:\system make\Ran-R-HAN` — อัพเดตล่าสุด 2026-09-13 09:52 (P1 Runtime Verification โดย Codex)

| รายการ | ผล | หมายเหตุ |
| :--- | :---: | :--- |
| `pnpm test` (unit) | 🟢 **PASS 228/228** | เพิ่มจาก 222 หลัง Codex เติมเทสต์ + smoke 4/4 PASS |
| **PostgreSQL integration** | 🟢 **PASS 11/11** | `pnpm test:db:service-area` — รัน SQL จริงกับ Postgres จริง |
| **Migration runtime** | 🟢 **PASS ครบ 16 ขั้น** | รวม Service Area `00006` |
| TypeScript | 🟢 **PASS** | |
| `git diff --check` | 🟢 **PASS** | |
| `pnpm build` | 🟢 **PASS** | 52/52 routes ผ่าน 3 รอบติดบน Node v24.19.0 หลังติดตั้ง node_modules ใหม่ |

### สภาพแวดล้อมที่ใช้ตรวจ (ทำซ้ำได้)

- Image ทางการ `supabase/postgres:15.8.1.085` (PostgreSQL **15.8** + PostGIS **3.3**) บน WSL2/Docker
- อ้างอิง [Supabase PG15 compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.pg15.yml)
- เปิดเฉพาะ local port `127.0.0.1:55432` ไม่ seed ข้อมูล ไม่ต่อฐานภายนอก
- Fixture ถูกล้างหมดหลังทดสอบ (เหลือ `0|0`) **ไม่แตะ production** container ถูกลบแล้ว image เก็บไว้ใช้รอบหน้า

### 11 สถานการณ์ที่ผ่าน

เจ้าของร้านแก้ร้านตัวเองได้ · ข้ามร้านถูกปฏิเสธ · ร้านที่เปิด enforcement แล้วล้างพิกัดไม่ได้ ·
ปิด direct write ที่ข้าม RPC · ออเดอร์ในเขตผ่าน · ออเดอร์นอกเขตถูกปฏิเสธ · ไม่มีพิกัดถูกปฏิเสธ (fail-closed) ·
ไรเดอร์ออกนอกเขตเริ่มจับเวลา · เกิน 15 นาที session ถูกปิด · กลับเข้าเขตแล้วเริ่มงานใหม่ได้ ·
Settings กับ GPS ทำงานพร้อมกันโดยไม่ deadlock

### ช่องว่างเดิมที่ปิดไปแล้ว ✅

ก่อนหน้านี้เอกสารฉบับนี้เตือนว่า `service-area-enforcement.test.ts` **ไม่ได้รัน SQL** (อ่านไฟล์เป็นข้อความแล้ว regex match)
ทำให้ migration ที่ syntax ผิดก็ยังผ่านเทสต์ได้

**ช่องว่างนี้ถูกปิดแล้ว** ด้วย `test/service-area-postgres.integration.cjs` ซึ่งรัน SQL จริงกับ Postgres จริง
รวมถึงทดสอบ concurrency ด้วย connection สองตัว — เทสต์ regex ยังอยู่ในฐานะ static check เท่านั้น ไม่ใช่หลักฐานหลักอีกต่อไป

### 🔧 Toolchain — `pnpm build` (แก้แล้ว ✅)

**ผลล่าสุด 2026-09-13: ผ่าน 3 รอบติด** บน Node **v24.19.0** — รอบที่ 1 ล้าง `.next` ก่อน
รอบที่ 2 และ 3 ใช้ cache เดิม ทั้งสามรอบ `Compiled successfully` 52 routes exit 0

**สาเหตุจริง: `node_modules` ที่ติดมาจากการย้าย SSD ข้ามเครื่อง**

แก้ด้วย
```
rm -rf node_modules .next
pnpm install --frozen-lockfile
```
`--frozen-lockfile` ผ่านใน 8 วินาที ยืนยันว่า lockfile ตรงกับ `package.json`

> ⚠️ **เรื่องนี้วินิจฉัยผิดมาแล้ว 2 รอบ บันทึกไว้กันเข้าใจผิดซ้ำ**
>
> | รอบ | สรุปตอนนั้น | ทำไมถึงผิด |
> | :-- | :--- | :--- |
> | 1 | `.next` cache เสีย ลบแล้วหาย | ลบแล้วผ่านจริง แต่เป็นเพราะได้ run ที่บังเอิญผ่าน หลังจากนั้นยังพังอีก |
> | 2 | บั๊ก Node 24 + Webpack `WasmHash` ต้องถอยไป Node 20/22 | ตอนนี้ผ่าน 3 รอบติดบน Node 24 ตัวเดิม ทฤษฎีนี้อธิบายหลักฐานไม่ได้แล้ว |
>
> **ยังไม่ต้องถอย Node และยังไม่ต้องปัก `engines`/`.nvmrc` เพื่อแก้อาการนี้**
> (จะปักเพื่อความสม่ำเสมอของทีมก็ทำได้ แต่คนละเหตุผล)

**ข้อจำกัดของหลักฐาน:** ผ่าน 3 รอบไม่เท่ากับพิสูจน์ว่านิ่งถาวร
ถ้าพังอีกให้ล้าง `node_modules` ก่อนเป็นอย่างแรก แล้วค่อยสงสัยเรื่องอื่น

## 5. ประวัติการตรวจสอบก่อนหน้า

รอบตรวจก่อนหน้าเคยพบบั๊กร้ายแรง 3 จุดใน migration (ขาด `shop_id` ตอน INSERT, record variable ใน multi-item INTO, upsert ขาด `shop_id`/`work_session_id`)

**ตรวจซ้ำรอบนี้แล้ว — แก้ไปแล้วทั้งหมด:**

- `start_rider_work_session` บรรทัด 452-453 → มี `shop_id` และ `device_info` ครบ
- `report_rider_location` บรรทัด 560-566 → upsert มี `shop_id` และ `work_session_id` ครบ

นอกจากนี้ของที่เคยทักว่า out-of-scope (`COUBD_ID` fail-open ใน cron routes, Telegram webhook, docs 2 ไฟล์) **ไม่ขึ้นเป็น modified แล้ว** = ถูก revert ไปเรียบร้อย

คุณภาพโค้ดที่เหลืออยู่ในเกณฑ์ดี: มี advisory lock, re-read แบบ `FOR UPDATE` หลังจับ lock, และใช้ `coalesce` รักษา `outside_area_since` ไม่ให้ reset จนเลี่ยงกฎ 15 นาทีได้

---

## 6. ลำดับการปิดงาน

| # | ขั้นตอน | สถานะ |
| :-: | :--- | :--- |
| 1 | ปิดสถานะ Service Area phase ปัจจุบัน | 🟢 **เสร็จ** |
| 2 | ทำ handoff แยก | 🟢 **เสร็จ** — เอกสารฉบับนี้ |
| 3 | ยืนยัน source of truth ของ test count | 🟢 **เสร็จ** — **228/228** |
| 4 | runtime-validate migration บน Postgres จริง | 🟢 **เสร็จ** — 16 migrations + 11 integration ผ่าน |
| 5 | เปิด session ใหม่ทำ Map phase | 🟡 **ปลดล็อกแล้ว** — รอเจ้าของงานสั่งเริ่ม |

**P1 Runtime Verification ปิดครบแล้ว** ตัวบล็อกเดิม (ข้อ 4) หมดไป

### งานที่ยังค้าง

**1. `supabase` dependency ที่ไม่มีใครใช้ — ควรเอาออก**

`package.json:45` มี `"supabase": "^2.117.0"` ใน `devDependencies` แต่**ไม่มีอะไรเรียกใช้เลย**

- `scripts/run-db.js` ใช้ `pg`
- `test/service-area-postgres.integration.cjs` ใช้ `pg`
- ไม่มี script/test/คำสั่งไหนเรียก supabase CLI

migration รันผ่าน Docker image + `pg` ล้วน ๆ ซึ่ง `pg` เป็น dependency เดิมอยู่แล้ว
ถ้าปล่อยไว้ ทุกเครื่องและ CI จะโหลด CLI binary แยก platform (`@supabase/cli-darwin-arm64`, linux, win) หลายสิบ MB ทุกครั้งที่ `pnpm install` เพื่อเครื่องมือที่ไม่มีใครเรียก

**2. `pnpm-lock.yaml` — ปนกัน 2 เรื่อง อย่า revert ทั้งไฟล์ก่อนตัดสินใจข้อ 1**

| ส่วน | คืออะไร | ทำยังไง |
| :--- | :--- | :--- |
| `supabase` + transitive (`@ecies/*`, `@noble/*`, `@supabase/cli-*`) | dependency จริงที่ถูกเพิ่ม | หายไปเองเมื่อลบตามข้อ 1 |
| `libc: [glibc]` ถูกลบ **28 บรรทัด เพิ่ม 0** บน `@img/sharp-libvips-linux-*` | noise จาก pnpm คนละเวอร์ชัน (เครื่องนี้ 9.15.9) ไม่มีใครแตะ sharp `lockfileVersion` ยังเป็น `9.0` เท่าเดิม | **revert** |

> ⚠️ การลบ `libc: [glibc]` ไม่ใช่แค่เรื่องความสวยงาม
> ถ้า CI รันบน Alpine/musl metadata ที่หายไปอาจทำให้ pnpm เลือก glibc build ผิดตัว

**ลำดับที่แนะนำ:** ลบ `supabase` ออกจาก `package.json` → `revert pnpm-lock.yaml` ทั้งไฟล์
เหลือใน `package.json` แค่ของจริง: เพิ่ม 2 test file เข้า test script + `test:db:service-area`

**3. `pnpm build`** — ✅ แก้แล้ว ผ่าน 3 รอบติด ดูหัวข้อ toolchain ในข้อ 4

**4. เอกสาร `docs/HANDOFF.md`** — แก้เลขเทสต์บรรทัด 224 และ 272 เป็น **228/228** และเพิ่มหัวข้อ Service Area (ตอนนี้ยังไม่มีเลย)

**5. Cron — ตัดสินใจแล้ว: ใช้ GitHub Actions** ✅

เคยมีสองแนวทางชนกัน ถ้าปล่อยขึ้นทั้งคู่ `data-retention` จะรันซ้ำวันละสองรอบ

| แนวทาง | สถานะ |
| :--- | :--- |
| `.github/workflows/cron-*.yml` (3 ไฟล์ ใน main checkout ยัง untracked) | 🟢 **เลือกใช้** ครบทั้ง 3 cron และเห็น log ที่เดียว |
| `vercel.json` → `"crons"` | ❌ **ทิ้ง** เคยมีค้างใน worktree `continue-6de032` ครอบแค่ data-retention และ Vercel free plan จำกัดจำนวน cron |

worktree `continue-6de032` ถูกลบไปแล้ว patch เก็บสำรองไว้ที่ scratchpad ของ session (ไม่ต้องใช้แล้ว)
**`vercel.json` ใน main checkout ไม่มี `crons` อยู่แล้ว จึงไม่ต้องแก้อะไร**

**6. Worktree — ล้างแล้ว** ✅

Claude worktree ที่ไม่มี commit ของตัวเองเลย (0 ahead) ถูกลบทิ้ง เพราะทำให้ session สับสนว่าโค้ดอยู่ไหน
จนรัน build/test ผิดที่มาแล้วหนึ่งรอบ

เหลือ 3 ตัว: `D:/system make/Ran-R-HAN` (หลัก) · `rider-telegram-worktree` (branch มี 13 commits) ·
`service-area-enforcement-audit-c08db0` (ว่าง ลบได้เลยเมื่อปิด session นั้น)

> 💡 **ทำงานจาก `D:\system make\Ran-R-HAN` ที่เดียวเท่านั้น** อย่าสร้าง worktree ใหม่สำหรับงานนี้อีก

### ข้อควรระวังตอน stage

`git status` มีของหลายงานปนกัน ต้องคัดเฉพาะไฟล์ตามรายการในข้อ 1 เท่านั้น
ไฟล์ที่ **ไม่ใช่** Service Area: `docs/rd/`, `public/qr/`, `record working time.md`,
`scripts/generate-field-test-doc.py`, `scripts/test-telegram-push.js`, `scripts/verify-production-cron.ts`,
`scripts/watch-live-order.ts`, ไฟล์ `.docx`/temp และ workflow `cron-data-retention.yml` + `cron-dispatch-timeout.yml`
(สองตัวหลังเป็นฟีเจอร์อื่น ควรแยก commit)

**พร้อม deploy ในแง่ build และ test แล้ว** — ที่เหลือคือ Gate 4 (ยืนยัน cron บน production จริง) และ Gate 6 (ทดสอบบนมือถือจริง)
