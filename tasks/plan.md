# Implementation Plan: ระบบพรีออเดอร์ RAN-R-HAN

## 1. เป้าหมาย

ทำระบบพรีออเดอร์ให้พร้อมใช้งานจริงแบบค่อยเป็นค่อยไป โดยเริ่มจากความถูกต้องของข้อมูล ความปลอดภัยแบบ multi-tenant และ lifecycle ของรอบพรีออเดอร์ก่อน จากนั้นจึงเชื่อมการชำระเงิน การสร้างเที่ยวส่ง และประสบการณ์ใช้งาน

สถานะปัจจุบันไม่ใช่ “ยังไม่มีโค้ด” แต่เป็น “มีโครงสร้างบางส่วนและยังเปิดใช้ไม่ได้อย่างปลอดภัย” ฐานข้อมูลจริงมีตาราง `preorder_rounds` และ `preorder_items` แล้ว แต่ยังไม่มีข้อมูล และหน้า `/admin/delivery/preorder/new` ขาด `page.tsx`

## 2. ขอบเขต

### ต้องทำก่อนเปิดใช้งาน (P0)

- มี feature flag/kill switch และค่าเริ่มต้นต้องปิด
- ร้านสร้าง ดู ปิด และแปลงรอบพรีออเดอร์ได้ครบเส้นทาง
- ห้ามเพิ่ม แก้ หรือลบรายการผิดร้าน
- ปิดรับรายการอัตโนมัติตาม `cutoff_at` และบังคับ state transition ฝั่งเซิร์ฟเวอร์
- การแปลงเป็นเที่ยวส่งต้อง atomic และ idempotent
- กำหนด workflow การชำระเงินที่ตรวจสอบได้
- มี unit, integration/security และ E2E tests สำหรับ critical path
- เอกสารสถานะต้องตรงกับโค้ดและฐานข้อมูลจริง

### ควรทำหลัง P0 (P1/P2)

- แจ้งเตือนก่อนปิดรอบและเมื่อสถานะเปลี่ยน
- รองรับแก้ไขรายการพร้อมประวัติการเปลี่ยนแปลง
- ปรับ bulk import ให้ตรวจข้อมูลซ้ำและแสดง confidence/warning
- สรุปยอดตามสินค้า จุดรับ และวิธีชำระเงิน
- เพิ่ม observability, usage metrics และ data-retention job
- พิจารณาเชื่อมรายการพรีออเดอร์กับ catalog/inventory แทนข้อความอิสระ

## 3. การตัดสินใจด้านสถาปัตยกรรม

- ใช้ Server Actions เดิมเป็น boundary แต่ทุก mutation ต้องตรวจ session, shop ownership และ validate input ฝั่งเซิร์ฟเวอร์
- ไม่เชื่อสถานะที่ส่งจาก UI; ฝั่งเซิร์ฟเวอร์เป็นผู้ตัดสิน state transition และ cutoff
- ใช้ migration ใหม่เท่านั้น ห้ามแก้ migration ที่เคยใช้แล้ว
- เพิ่ม `converted_trip_id` หรือ conversion record ที่มี unique constraint เพื่อกันสร้างเที่ยวซ้ำ
- ทำการสร้าง trip, สร้าง trip items และปิดรอบใน PostgreSQL transaction/RPC เดียว
- ใช้ feature flag ระดับระบบหรือร้าน เพื่อให้ deploy โค้ดได้โดยยังไม่เปิดฟีเจอร์
- ข้อมูลจาก Facebook comment เป็นข้อมูลส่วนบุคคล ต้องมี audit trail, จำกัดสิทธิ์ และกำหนดอายุข้อมูล

## 4. Dependency Graph

```text
Feature flag + contract
        |
        +--> Lifecycle/cutoff rules
        |          |
        |          +--> Secure item mutations
        |          |          |
        |          |          +--> Atomic conversion to delivery trip
        |          |
        |          +--> Payment workflow
        |
        +--> Create-round route/UI

Foundations above --> Integration/E2E tests --> Controlled rollout
                                      |
                                      +--> P1/P2 improvements
```

## 5. ลำดับการดำเนินงาน

### Phase A — Safety Gate และ Contract (ต้องทำ)

#### Task 1: เพิ่ม feature flag และกำหนด lifecycle contract

กำหนดสถานะที่อนุญาต (`open -> closed -> completed`) พฤติกรรม cutoff และเงื่อนไขเปิดใช้ โดยเขียนเป็น type/schema และเอกสารก่อนแก้ behavior

**Acceptance criteria**

- [ ] ค่าเริ่มต้นของพรีออเดอร์เป็น disabled
- [ ] กำหนด transition ที่อนุญาตและห้ามย้อน `completed`
- [ ] กำหนดว่าเมื่อเลย cutoff ระบบปฏิเสธรายการใหม่ แม้ UI ยังเปิดอยู่

**Verification**

- [ ] Unit tests ของ transition และ cutoff fail ก่อน implementation และผ่านหลัง implementation
- [ ] `node_modules/.bin/tsc.cmd --noEmit` ผ่าน

**Dependencies:** ไม่มี

**Files likely touched:** `src/lib/plans.ts`, `src/lib/validations/delivery.ts`, `test/delivery.test.ts`, `docs/KNOWLEDGE.md`

**Estimated scope:** M

#### Task 2: ซ่อมเส้นทางเปิดรอบพรีออเดอร์แบบ end-to-end

เพิ่ม server page สำหรับ `/admin/delivery/preorder/new` ตรวจ authentication/shop และเชื่อมกับ client form ที่มีอยู่

**Acceptance criteria**

- [ ] ผู้ใช้ที่ login และมีร้านเปิดหน้าสร้างรอบได้
- [ ] ผู้ใช้ที่ไม่ login ถูก redirect ไป `/login`
- [ ] ร้านที่ปิด feature flag ไม่สามารถสร้างรอบผ่าน UI หรือ Server Action

**Verification**

- [ ] Route/component test ผ่าน
- [ ] Manual check: เปิดหน้า กรอกข้อมูล และเห็น validation error ที่ถูกต้อง

**Dependencies:** Task 1

**Files likely touched:** `src/app/admin/delivery/preorder/new/page.tsx`, `src/app/admin/delivery/preorder/new/NewPreorderRoundClient.tsx`, `src/app/actions/delivery.ts`, `test/preorder-route.test.ts`

**Estimated scope:** M

### Checkpoint A

- [ ] Feature ยังปิดโดยค่าเริ่มต้น
- [ ] TypeScript ผ่าน
- [ ] สร้างรอบผ่านเส้นทางจริงได้เมื่อเปิด flag ใน test environment
- [ ] ทบทวน contract กับเจ้าของระบบก่อนทำ mutation อื่น

### Phase B — Data Integrity และ Multi-tenant Security (ต้องทำ)

#### Task 3: บังคับสถานะและ cutoff ในทุก item mutation

รวม guard สำหรับเพิ่มแบบ manual, bulk import, แก้ไข และลบรายการ เพื่อให้กฎเดียวกันทุก entry point

**Acceptance criteria**

- [ ] เพิ่มรายการได้เฉพาะรอบ `open` และก่อน cutoff
- [ ] Bulk import validate ทุกรายการด้วย schema เดียวกับ manual entry
- [ ] กำหนดจำนวนรายการสูงสุดต่อ request และคืน error แบบคงที่

**Verification**

- [ ] Tests ครอบคลุม open/closed/completed, ก่อน/หลัง cutoff และ malformed bulk payload
- [ ] Manual check: UI แสดง error จาก server โดยไม่ทำข้อมูลบางส่วนค้าง

**Dependencies:** Task 1

**Files likely touched:** `src/app/actions/delivery.ts`, `src/lib/validations/delivery.ts`, `test/preorder-actions.test.ts`

**Estimated scope:** M

#### Task 4: ปิดช่องโหว่ลบข้อมูลข้ามร้าน

การลบต้องผูก `itemId` กับ `roundId` และยืนยันว่า round เป็นของร้านใน session ก่อนใช้ admin client

**Acceptance criteria**

- [ ] ลบได้เฉพาะ item ที่อยู่ใน round ของร้านผู้ใช้
- [ ] `itemId` ของร้านอื่นถูกปฏิเสธและข้อมูลไม่เปลี่ยน
- [ ] UUID และ input ทุกตัวถูก validate ก่อน query

**Verification**

- [ ] Security regression tests แบบสองร้านผ่าน
- [ ] Query ลบมีทั้ง `id` และ `round_id` หรือใช้ RPC ที่มี tenant guard

**Dependencies:** Task 3

**Files likely touched:** `src/app/actions/delivery.ts`, `src/lib/validations/delivery.ts`, `test/preorder-security.test.ts`

**Estimated scope:** S

#### Task 5: ทำ conversion เป็น trip แบบ atomic และ idempotent

ย้ายการแปลงรอบไป PostgreSQL RPC/transaction และใช้ unique constraint กันการเรียกซ้ำ

**Acceptance criteria**

- [ ] การเรียกซ้ำด้วย round เดิมคืน trip เดิมหรือ error แบบกำหนดไว้ โดยไม่สร้างซ้ำ
- [ ] หากสร้าง trip item ไม่สำเร็จ จะไม่เหลือ trip ครึ่งชุด
- [ ] แปลงได้เฉพาะรอบที่ปิดแล้วและผ่านเงื่อนไขการชำระเงิน

**Verification**

- [ ] Database integration tests ครอบคลุม success, rollback และ concurrent duplicate
- [ ] ตรวจจำนวน trip และ trip items หลัง retry

**Dependencies:** Tasks 3–4

**Files likely touched:** `supabase/migrations/<new>_preorder_conversion_rpc.sql`, `src/app/actions/delivery.ts`, `src/lib/types.ts`, `test/preorder-conversion.test.ts`

**Estimated scope:** M

### Checkpoint B

- [ ] Multi-tenant security tests ผ่าน
- [ ] Conversion retry ไม่สร้างข้อมูลซ้ำ
- [ ] Failure injection ไม่เหลือข้อมูลครึ่งชุด
- [ ] Full test suite ที่ไม่ต้องเรียกบริการภายนอกผ่าน

### Phase C — Payment และ Operational Flow (ต้องทำ)

#### Task 6: กำหนดและทำ payment lifecycle

กำหนด flow สำหรับ `cash/COD` และ `promptpay` ว่าใครยืนยันได้ เมื่อใด และ conversion ต้องรอ payment แบบใด

**Acceptance criteria**

- [ ] มี action/RPC สำหรับเปลี่ยน `payment_status` พร้อม authorization และ audit log
- [ ] PromptPay ไม่ถูก mark verified จาก client โดยตรง
- [ ] หน้ารอบแสดงยอด pending/verified แยกชัดเจน

**Verification**

- [ ] Payment authorization and transition tests ผ่าน
- [ ] Manual check: cash/COD และ PromptPay แสดงสถานะถูกต้อง

**Dependencies:** Tasks 3–4

**Files likely touched:** `supabase/migrations/<new>_preorder_payment.sql`, `src/app/actions/delivery.ts`, `src/app/admin/delivery/preorder/[id]/PreorderRoundDetailClient.tsx`, `test/preorder-payment.test.ts`

**Estimated scope:** M

#### Task 7: ทำ lifecycle UI ให้สอดคล้องกับ server

ปิดปุ่มเพิ่ม/นำเข้าเมื่อเลย cutoff หรือสถานะไม่ใช่ open, จำกัดตัวเลือกสถานะ และแสดง conversion/payment readiness

**Acceptance criteria**

- [ ] UI ไม่เสนอ transition ที่ผิดกฎ
- [ ] ปุ่ม convert เปิดเฉพาะเมื่อ server ระบุว่า ready
- [ ] Error และ loading state ไม่ทำให้ผู้ใช้กดซ้ำโดยไม่ตั้งใจ

**Verification**

- [ ] Component tests ครอบคลุมทุก state
- [ ] Browser check บนมือถือและเดสก์ท็อป

**Dependencies:** Tasks 3, 5–6

**Files likely touched:** `src/app/admin/delivery/preorder/[id]/PreorderRoundDetailClient.tsx`, `src/app/admin/delivery/preorder/PreorderRoundsClient.tsx`, `src/lib/types.ts`, `test/preorder-ui.test.tsx`

**Estimated scope:** M

#### Task 8: เพิ่ม critical-path E2E และ readiness check

ทดสอบตั้งแต่เปิดรอบ เพิ่มรายการ ปิดรอบ ยืนยันการชำระ แปลงเป็นเที่ยว และป้องกันการทำซ้ำ

**Acceptance criteria**

- [ ] E2E happy path ผ่าน
- [ ] E2E ปฏิเสธรายการหลัง cutoff และผู้ใช้ข้ามร้าน
- [ ] มี readiness checklist ที่ตรวจ migration, env และ feature flag ก่อนเปิดใช้

**Verification**

- [ ] `pnpm test` ผ่านหลังแก้ปัญหา test runner
- [ ] `node_modules/.bin/tsc.cmd --noEmit` ผ่าน
- [ ] `pnpm build` ผ่าน

**Dependencies:** Tasks 1–7

**Files likely touched:** `test/preorder-e2e.test.ts`, `scripts/verify-preorder-readiness.js`, `package.json`, `docs/DEPLOY.md`

**Estimated scope:** M

### Checkpoint C — Go/No-Go

- [ ] P0 tests และ build ผ่านทั้งหมด
- [ ] Migration ถูกใช้ใน staging และตรวจ rollback/retry แล้ว
- [ ] ไม่มี secret หรือข้อมูลลูกค้าใน logs
- [ ] เจ้าของระบบทดสอบ critical path และอนุมัติ
- [ ] เปิด feature flag ให้ร้านทดลองเพียงร้านเดียวก่อน

### Phase D — Improvements (ควรทำหลังเปิดทดลอง)

#### Task 9: เพิ่ม summary และ duplicate detection

เพิ่มสรุปยอดตามสินค้า/จุดรับ/การชำระ และเตือนรายการนำเข้าที่เบอร์โทรกับข้อความซ้ำ

**Acceptance criteria**

- [ ] สรุปยอดตรงกับรายการต้นทาง
- [ ] รายการต้องสงสัยไม่ถูกบันทึกซ้ำโดยไม่เตือน
- [ ] ผู้ใช้ตรวจและแก้รายการก่อนยืนยัน bulk import ได้

**Verification:** Unit tests ของ aggregation/deduplication และ manual import check

**Dependencies:** Task 8

**Files likely touched:** `src/lib/delivery-parser.ts`, `src/app/admin/delivery/preorder/[id]/PreorderRoundDetailClient.tsx`, `test/delivery.test.ts`

**Estimated scope:** M

#### Task 10: เพิ่ม notifications และ observability

แจ้งเตือนก่อน cutoff/เมื่อปิดรอบ บันทึก metric จำนวนรายการ error rate และ conversion latency โดยไม่เก็บ PII ใน telemetry

**Acceptance criteria**

- [ ] การแจ้งเตือน retry ได้และไม่ส่งซ้ำ
- [ ] Dashboard/monitor เห็น failure ของ import และ conversion
- [ ] Logs ไม่มีชื่อ เบอร์โทร ที่อยู่ หรือ raw comment

**Verification:** Notification idempotency tests และตรวจ log fields

**Dependencies:** Task 8

**Files likely touched:** `src/lib/telegram.ts`, `src/app/actions/delivery.ts`, `src/lib/preorder-observability.ts`, `test/preorder-notifications.test.ts`

**Estimated scope:** M

#### Task 11: ทำ PDPA retention และ operational runbook

กำหนดอายุข้อมูล raw Facebook comments, ขั้นตอนลบ/ส่งออก และ runbook เมื่อ import ผิดหรือข้อมูลรั่ว

**Acceptance criteria**

- [ ] มี retention period ที่เจ้าของระบบและที่ปรึกษากฎหมายยืนยัน
- [ ] ลบ raw input ตามกำหนดโดยไม่ทำลายหลักฐานทางบัญชีที่ต้องเก็บ
- [ ] มีขั้นตอน incident response และ manual recovery

**Verification:** Retention job tests และ tabletop review ของ runbook

**Dependencies:** Task 8

**Files likely touched:** `supabase/migrations/<new>_preorder_retention.sql`, `scripts/preorder-retention.js`, `docs/PREORDER-RUNBOOK.md`, `test/preorder-retention.test.ts`

**Estimated scope:** M

## 6. ความเสี่ยงและแนวทางลดความเสี่ยง

| ความเสี่ยง | ระดับ | แนวทางลดความเสี่ยง |
|---|---:|---|
| ใช้ admin client แล้ว query ไม่ผูก tenant | สูง | ownership guard ทุก mutation + security tests สองร้าน |
| Conversion ถูกเรียกซ้ำหรือค้างครึ่งทาง | สูง | RPC transaction + unique constraint + idempotency tests |
| รับรายการหลัง cutoff | สูง | ตรวจเวลาฝั่ง DB/server ไม่พึ่ง UI |
| สถานะชำระเงินถูกแก้จาก client | สูง | privileged RPC/action + audit log |
| ข้อมูล Facebook comment เป็น PII | สูง | จำกัดสิทธิ์, redact logs, retention และทนายตรวจฐานกฎหมาย |
| เอกสารบอกว่าเสร็จแต่ระบบยังไม่พร้อม | กลาง | readiness checklist และปรับ `KNOWLEDGE.md`/`HANDOFF.md` ตามหลักฐาน |
| Test runner `tsx` ล้มด้วย `uv_os_get_passwd ENOMEM` | กลาง | แก้ runtime/toolchain ก่อนใช้ผล tests เป็น release gate |

## 7. คำถามที่ต้องตัดสินใจก่อน Task 6/11

1. PromptPay ของพรีออเดอร์จะใช้ SlipOK/OkSlip เดิม หรือให้พนักงานยืนยันเองในเฟสแรก
2. COD ถือว่าพร้อมแปลงเป็นเที่ยวทันที หรือจำเป็นต้องมีสถานะ `confirmed` แยกจาก `verified`
3. ร้านแก้รายการได้หลังปิดรอบหรือไม่ และใครมีสิทธิ์ reopen
4. เก็บ `raw_input_text` จาก Facebook กี่วัน
5. เปิดให้ลูกค้าสร้างพรีออเดอร์เองผ่านหน้าเว็บในเฟสนี้หรือเป็น admin import เท่านั้น

## 8. Definition of Done ก่อนเปิดใช้จริง

- P0 Tasks 1–8 และ Checkpoints A–C ผ่านครบ
- ไม่มี known P0/P1 security issue ค้าง
- ทดสอบ staging ด้วยร้านทดลองและข้อมูลจำลอง
- เอกสาร `KNOWLEDGE.md`, router map, deployment guide และ handoff ตรงกับระบบจริง
- มีวิธีปิด feature ทันทีโดยไม่ deploy ใหม่
- เจ้าของระบบอนุมัติ Go-Live หลังดูผล E2E และ readiness report
