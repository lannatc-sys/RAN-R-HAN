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

## 2. ลำดับงานถัดไป

1. Merge PR #2 เมื่อเจ้าของโปรเจกต์อนุมัติ
2. ซิงก์ `fix/auth-idor-hardening` กับ `main` หลัง merge และตรวจไม่ให้ diff ของ PR #2 ซ้ำ
3. รัน targeted security tests แล้วเปิด PR แยกสำหรับ auth/IDOR hardening
4. Deploy และตรวจ cron บน production
5. ทดสอบภาคสนามบน Android และ iPhone จริง
6. ทำ Service Area Map ต่อจาก migration WIP บน `feat/service-area-map`

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
