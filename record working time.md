# ⏱️ บันทึกรายงานการทำงาน (Record Working Time & Activity Log)

**โครงการ:** RAN-R-HAN (ระบบบริหารจัดการร้านอาหาร, ครัว KDS และไรเดอร์จัดส่งอาหาร)  
**วันที่บันทึก:** 12 กันยายน 2026  
**ผู้บันทึก:** Antigravity AI Assistant  
**สถานะภาพรวม:** เตรียมระบบพร้อมสำหรับการทดสอบบนฮาร์ดแวร์จริง — **ยังไม่ได้ทดสอบบนมือถือจริง (Physical Device E2E: PENDING)**

---

## 📋 สรุปรายการคำสั่ง, การดำเนินงาน และสถานะงาน

| ลำดับ | คำสั่งจากผู้ใช้งาน | สิ่งที่ระบบดำเนินการไปแล้ว | ผลลัพธ์ / ไฟล์ที่เกี่ยวข้อง | สถานะการทำงาน |
|:---:|---|---|---|:---:|
| **1** | **Merge Rider PR #1 — เร็วสุด**<br>- เวลา: 5–15 นาที<br>- ปลดล็อกระบบ Rider เข้า main | • ตรวจสอบสถานะ PR #1 (`gh pr view 1`) และสถานะ CI/Vercel (ผ่านครบถ้วน)<br>• ยืนยันความปลอดภัยตามกฎ Git Safety ด้วย Interactive Confirmation<br>• ดำเนินการ **Squash and merge** PR #1 เข้าสู่ branch `main` (Commit `5f32de6`)<br>• ซิงก์ Git repository ในเครื่องด้วย `git fetch origin main` | • PR #1 ถูกเปลี่ยนสถานะเป็น `MERGED`<br>• โค้ดระบบ Rider Phase 1 เข้าสู่ `main` อย่างเป็นทางการ | **สำเร็จ**<br>(MERGED) |
| **2** | **ตั้ง External Cron และยิงทดสอบ Production**<br>- ตั้ง Dispatch Timeout ทุก 1 นาที<br>- ตั้ง Data Retention วันละครั้ง<br>- ตรวจ 401 เมื่อ secret ผิด, 200 เมื่อ secret ถูก | • วิเคราะห์เส้นทาง `/api/cron/dispatch-timeout` และ `/api/cron/data-retention`<br>• ยิงทดสอบ Production พบว่าคืน 401 เมื่อ secret ผิดหรือไม่มี auth header ตามข้อกำหนดความปลอดภัย<br>• ตรวจพบว่า Secret ใน `.env.local` เดิม ไม่ตรงกับที่ตั้งไว้บน Vercel Production<br>• สร้างสคริปต์ทดสอบอัตโนมัติ `scripts/verify-production-cron.ts`<br>• จัดเตรียม GitHub Actions Workflow สำหรับ Cron รายวันและฉุกเฉิน | • [`.github/workflows/cron-data-retention.yml`](file:///d:/system%20make/Ran-R-HAN/.github/workflows/cron-data-retention.yml)<br>• [`.github/workflows/cron-dispatch-timeout.yml`](file:///d:/system%20make/Ran-R-HAN/.github/workflows/cron-dispatch-timeout.yml)<br>• [`scripts/verify-production-cron.ts`](file:///d:/system%20make/Ran-R-HAN/scripts/verify-production-cron.ts) | **สำเร็จ**<br>(PASSED) |
| **3** | **บันทึก COUBD_ID ตรงกันแล้ว ทั้ง local และ Vercel**<br>- ยืนยันการแมป Secret ให้ตรงกัน | • นำค่า Secret (`«REDACTED — ดูค่าจริงจาก .env.local / Vercel env»`) ไปยิงทดสอบ Production จริง<br>• ผลทดสอบส่งกลับ **HTTP 200 OK** ทั้งสอง endpoints<br>• อัปเดตค่า `CRON_SECRET` ใน `.env.local` ให้ตรงกัน<br>• รันสคริปต์ทดสอบในเครื่องและบน Production ผ่าน 100%<br>• จัดทำเอกสารค่า Headers และ URLs สำหรับกรอกใน cron-job.org | • [`.env.local`](file:///d:/system%20make/Ran-R-HAN/.env.local) (อัปเดต `CRON_SECRET`)<br>• ผลทดสอบยิง Production ผ่านฉลุย (Status: 200 OK) | **สำเร็จ**<br>(100% OK) |
| **4** | **ทดสอบ Core Flow บนมือถือจริง**<br>- เริ่มจาก Android ตามด้วย iPhone<br>- Order → Payment → KDS → Dispatch → Rider → POD → Settlement<br>- ใช้สลิป SlipOK จริง 1 รายการ | • ตรวจสอบความพร้อมของร้านค้าทดลอง `krua-pa-daeng` (ครัวป้าแดง)<br>• เปิดตัวเลือก Delivery ให้ร้านค้าด้วย `node scripts/enable-all-systems.js`<br>• ตรวจสอบพิกัดร้านค้า (`19.3005, 97.9678`) และเมนูอาหาร<br>• ตรวจสอบบัญชีไรเดอร์ 2 คน (`rider1.kruapa@gmail.com` และ `rider2.kruapa@gmail.com`) พร้อมรหัสผ่าน `<ดูจาก .env.local ตัวแปร PILOT_RIDER_PASSWORD>` ในระดับ Script Simulation<br>• **หมายเหตุสำคัญ:** เป็นการทดสอบจำลองเชิงระบบ (Scenario Simulation) เท่านั้น **ยังไม่ได้ทดสอบบนอุปกรณ์จริง (Physical-Device Test)** | • ฐานข้อมูลร้านค้าและไรเดอร์พร้อม<br>• **ยังไม่ได้ทดสอบบนมือถือจริง** (Pending Physical Execution) | 🟡 **ยังไม่เสร็จ**<br>(รอดำเนินการบนเครื่องจริง) |
| **5** | **ทำคู่มือ ทดสอบให้ผม**<br>- ขอเอกสารคู่มือทดสอบฉบับสมบูรณ์สำหรับมือถือ | • จัดทำคู่มือฉบับทางการ [`docs/mobile-core-flow-testing-guide.md`](file:///d:/system%20make/Ran-R-HAN/docs/mobile-core-flow-testing-guide.md)<br>• บันทึกรายละเอียดบัญชีเข้าใช้งาน, ลิงก์ระบบ, ขั้นตอนการสั่ง, สลิปจริง, KDS, Rider, กล้อง POD และ Settlement<br>• เพิ่มตาราง Checkpoints เปรียบเทียบ Android vs iOS Safari<br>• สร้างเครื่องมือ Terminal Live Monitor เพื่อตรวจจับเหตุการณ์บน DB เรียลไทม์ | • [`docs/mobile-core-flow-testing-guide.md`](file:///d:/system%20make/Ran-R-HAN/docs/mobile-core-flow-testing-guide.md)<br>• [`scripts/watch-live-order.ts`](file:///d:/system%20make/Ran-R-HAN/scripts/watch-live-order.ts) | **สำเร็จ**<br>(DOCUMENTED) |
| **6** | **ลิงค์ ให้แนบ QR สแกนลิงค์ด้วยคับ**<br>- แนบรูปภาพ QR Code สำหรับสแกนเข้าหน้าจอบนมือถือ | • ใช้ Node.js + `qrcode` เจนเนอเรตไฟล์ภาพ QR Code ขนาด 350x350px 3 ภาพ:<br>  1. `qr-rider-pwa.png` (Rider PWA)<br>  2. `qr-customer-menu.png` (Customer Delivery)<br>  3. `qr-kds-kitchen.png` (KDS Orders PIN `0000`)<br>• บันทึกไฟล์ลง `public/qr/` และ Artifacts directory<br>• อัปเดตแทรกรูปภาพ QR Code ลงในคู่มือทดสอบและ Artifact การ์ดสแกน<br>• แสดงผล QR Code แบบภาพจริงในแชทให้ยกมือถือสแกนได้ทันที | • [`public/qr/qr-rider-pwa.png`](file:///d:/system%20make/Ran-R-HAN/public/qr/qr-rider-pwa.png)<br>• [`public/qr/qr-customer-menu.png`](file:///d:/system%20make/Ran-R-HAN/public/qr/qr-customer-menu.png)<br>• [`public/qr/qr-kds-kitchen.png`](file:///d:/system%20make/Ran-R-HAN/public/qr/qr-kds-kitchen.png)<br>• [`mobile_testing_qr_cards.md`](file:///C:/Users/GAME/.gemini/antigravity-ide/brain/b50c929f-3469-400c-8ad9-1d704a73870e/mobile_testing_qr_cards.md) | **สำเร็จ**<br>(ATTACHED) |
| **7** | **อัพเดตคู่มือทดสอบระบบ + ทำเป็นไฟล์ Word (.docx) สำหรับออกไปทำรอบเดียว**<br>- แยกสิ่งที่ต้องไปทำจริงในพื้นที่<br>- ทำไฟล์ doc สำหรับพิมพ์/พกพา | • พัฒนาสคริปต์ Python `scripts/generate-field-test-doc.py` สร้างเอกสาร Word (.docx) มาตรฐาน<br>• ใส่เนื้อหาเฉพาะ 'สิ่งที่ต้องออกไปทำจริงบนเครื่องในพื้นที่ อ.เมือง แม่ฮ่องสอน รอบเดียว' 8 สเต็ป<br>• แทรกภาพ QR Code ทั้ง 3 ระบบ, ข้อมูลบัญชีล็อกอิน, กล่อง Callout คำเตือน, ตารางประเมินผล และช่องเซ็นชื่ออนุมัติ Go/No-Go<br>• สร้างไฟล์สำเร็จทั้งชื่อภาษาไทยและอังกฤษในโฟลเดอร์ `docs/` | • [`docs/คู่มือทดสอบภาคสนาม_Core_Flow_มือถือจริง.docx`](file:///d:/system%20make/Ran-R-HAN/docs/คู่มือทดสอบภาคสนาม_Core_Flow_มือถือจริง.docx)<br>• [`docs/mobile-field-test-guide.docx`](file:///d:/system%20make/Ran-R-HAN/docs/mobile-field-test-guide.docx)<br>• [`docs/mobile-core-flow-testing-guide.md`](file:///d:/system%20make/Ran-R-HAN/docs/mobile-core-flow-testing-guide.md) | **สำเร็จ**<br>(DOCX GENERATED) |

---

## 🚦 สรุปความพร้อมเทียบกับ Pilot Verification Matrix ([HANDOFF.md](file:///d:/system%20make/Ran-R-HAN/docs/HANDOFF.md#L262-L274))

| Gate | รายการตรวจสอบตามสถาปัตยกรรม | สถานะปัจจุบัน | รายละเอียดข้อเท็จจริง |
|:---:|---|:---:|---|
| **Gate 1** | Production Migration `20260912000004` | **PASS** | คอลัมน์ `push_enabled`, `telegram_chat_id` บน Supabase Production เรียบร้อย |
| **Gate 2** | พิกัดร้าน Pilot "ครัวป้าแดง" | **PASS** | บันทึกพิกัดจริง `19.3005, 97.9678` (เทศบาลเมืองแม่ฮ่องสอน) เรียบร้อย |
| **Gate 3** | บัญชี Pilot Rider (2 บัญชี) | **PASS** | `rider1` และ `rider2` ทดสอบ Auth, Work Session และ PDPA purge ในระบบจำลองผ่าน |
| **Gate 4** | External Scheduler `/api/cron/dispatch-timeout` | **PASS** | **ทดสอบจริงบน Deployed Production สำเร็จแล้ว** (ตอบกลับ 200 OK เมื่อ Secret ถูกต้อง) |
| **Gate 5** | Live Notification & Dispatch E2E | **PASS** | ทดสอบ Full Flow บน Production DB ผ่าน PostGIS, Offer, Graceful Notification Fallback ผ่าน |
| **Gate 6** | **Physical Device E2E (Android + iOS PWA)** | 🔴 **NOT YET VERIFIED**<br>*(รอดำเนินการจริง)* | **ห้ามถือว่าผ่านจนกว่าจะทดสอบบนฮาร์ดแวร์จริงในพื้นที่ อ.เมือง แม่ฮ่องสอน**<br>รายการที่ต้องตรวจจริงบนเครื่อง:<br>1. Android + iPhone ติดตั้ง PWA บน Home Screen<br>2. Background GPS พิกัดวิ่งตามจริงขณะเคลื่อนที่<br>3. Web Push Notification / การสั่นเตือนเมื่อมี Offer เข้า<br>4. กล้องมือถือจริงเปิดถ่ายรูปและอัปโหลด POD สำเร็จ<br>5. วงจร รับงาน–ส่งอาหาร–ปิดงาน ในพื้นที่จริง |
| **Gate 7** | Quality Gates (Unit/Smoke/Typecheck/Build) | **ALL PASS** | Unit: 171/171 PASS, Smoke: 4/4 PASS, TSC: 0 errors, Build: 35/35 routes success |
| **Gate 8** | Git Branch & PR Organization | **MERGED** | PR #1 ถูก Merge เข้าสู่ `main` (Commit `5f32de6`) เรียบร้อย |

---

## 📌 ขั้นตอนและสถานะปัจจุบัน (Current Progress)

- **ความจริงของระบบ Rider (Ground Truth):**
  - ผลการทดสอบ E2E ปัจจุบันในโค้ดเบส (`test/rider-e2e-scenarios.test.ts` และ `scripts/test-live-notification-e2e.ts`) เป็นเพียง **Scenario Simulation / Code Simulation**
  - **ยังไม่เคยมีการทดสอบบนอุปกรณ์ฮาร์ดแวร์มือถือจริง (Physical Device E2E ยังไม่ผ่าน - Gate 6 PENDING)**
  - นำเครื่องมือถือจริง (Android เครื่องที่ 1 และ iPhone เครื่องที่ 2) ไปเปิดทดสอบตามคู่มือ [`docs/mobile-core-flow-testing-guide.md`](file:///d:/system%20make/Ran-R-HAN/docs/mobile-core-flow-testing-guide.md) ในพื้นที่จริง เพื่อปลดล็อก **Gate 6** ต่อไป

---

## ⚠️ ข้อเท็จจริงสำคัญเกี่ยวกับระบบ Preorder (P0 Blockers Remain)

> [!WARNING]
> **ระบบ Preorder ยังมี P0 ค้าง และยังไม่พร้อมใช้งานจริง (ห้ามเปิด Pilot เด็ดขาด)**  
> รายงานก่อนหน้านี้ที่ระบุว่า Preorder "พร้อมสมบูรณ์" เป็นการสรุปที่**เกินหลักฐานจากโค้ดจริง** ตามที่ระบุใน [`tasks/todo.md`](file:///d:/system%20make/Ran-R-HAN/tasks/todo.md) และ [`tasks/plan.md`](file:///d:/system%20make/Ran-R-HAN/tasks/plan.md):

1. **ไม่บังคับสถานะรอบและ Cutoff ([`delivery.ts:L688`](file:///d:/system%20make/Ran-R-HAN/src/app/actions/delivery.ts#L688)):**
   - ใน `addPreorderItemAction` และ `addBulkPreorderItemsAction` ขาดการตรวจสอบ `round.status === 'open'` และ `now() <= round.cutoff_at` ทำให้เพิ่มรายการหลังเวลาตัดรอบหรือในรอบที่ปิดแล้วได้
2. **ช่องโหว่ลบข้อมูลข้ามร้าน / IDOR ([`delivery.ts:L762`](file:///d:/system%20make/Ran-R-HAN/src/app/actions/delivery.ts#L762)):**
   - คำสั่งลบตรวจสิทธิ์ร้านจาก `roundId` แต่ตอนสั่งลบเรียก `.from('preorder_items').delete().eq('id', itemId)` โดยไม่ผูก `round_id = roundId` ทำให้เสี่ยงลบรายการของร้านอื่นได้หากส่ง `itemId` แปลกปลอม
3. **การแปลงรอบเป็นเที่ยวส่งไม่ Atomic / Idempotent ([`delivery.ts:L861`](file:///d:/system%20make/Ran-R-HAN/src/app/actions/delivery.ts#L861)):**
   - `convertPreorderRoundToTripAction` แยกยิงคำสั่งโดยไม่มี DB Transaction หากล้มเหลวกลางคันจะเกิดข้อมูลค้าง และไม่มีการป้องกันการกดแปลงซ้ำ (Duplicate Trips)
4. **ขาด Payment Lifecycle & Authorization:**
   - ยังไม่มีเวิร์กโฟลว์ชำระเงินที่รัดกุมพร้อมการตรวจสิทธิ์และ Audit Log
5. **Checklist P0 ยังไม่ผ่าน:**
   - ใน [`tasks/todo.md`](file:///d:/system%20make/Ran-R-HAN/tasks/todo.md) ยังไม่ผ่าน Checkpoint A, B, C แม้แต่ข้อเดียว จึงต้องปิดระบบ Preorder ไว้ก่อนจนกว่าจะดำเนินการตามแผน P0

---

## ⏸️ ระบบและฟีเจอร์ที่พักไว้/ยังเป็นแผนงานในอนาคต (Intentionally Deferred Scope)

### 1. บทบาท Telegram Bot (ยืนยันสถาปัตยกรรมแล้ว):
- **ข้อสรุปและบทบาททางการ:** ผู้ใช้กำหนดนโยบายชัดเจนว่า **`@ranrhan_bot` จะทำหน้าที่เป็นบอทสำหรับงานไรเดอร์ (Rider Dispatch & Operations) โดยเฉพาะ 100%** เพื่อใช้เป็นช่องทางสื่อสารและรับงานของไรเดอร์
- **สิ่งที่พัฒนาแล้ว:**
  - Webhook ปรับปรุงให้รองรับบทบาทไรเดอร์โดยตรง ([`src/app/api/telegram/webhook/route.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/api/telegram/webhook/route.ts))
  - คำสั่ง `/start` ตรวจจับสถานะไรเดอร์อัตโนมัติ แสดงข้อมูลชื่อ, เบอร์โทร, สถานะงาน, และปุ่มเปิด PWA
  - คำสั่ง `/status` สำหรับตรวจสอบสถานะงานไรเดอร์
  - คำสั่ง `/link <เบอร์โทร>` ให้ไรเดอร์ผูกบัญชี Telegram ด้วยเบอร์โทรศัพท์ได้ทันทีโดยไม่ต้องจำ UUID
  - ระบบ Dispatch ([`src/lib/rider-notification.ts`](file:///d:/system%20make/Ran-R-HAN/src/lib/rider-notification.ts)) ยิง Push งานใหม่ตรงเข้า Telegram ไรเดอร์
- **สิ่งที่ยังเป็นแผนงานอนาคตสำหรับ Rider:** ระบบสำรองเงินสด COD (Rider Prepayment), ตัวเลือกเปิด/ปิดการนับถอยหลังต่อออเดอร์, และ Incident / Dispute Flow

### 2. Customer Account & ระบบหลักฐานข้อพิพาท (ยังไม่ได้เริ่มพัฒนา):
- **สภาพฐานข้อมูลและโค้ดจริง:** ยังไม่มีตาราง `customer_accounts`, `shop_customers`, หรือ Evidence Ledger อยู่ใน Database Schema หรือโค้ดเบส
- **การตัดสินใจทางสถาปัตยกรรม (Architectural Decision):** ตั้งใจพักการพัฒนาระบบนี้ไว้ก่อนอย่างเป็นทางการ จนกว่าจะทดสอบ Core Flow ในพื้นที่จริงสำเร็จ และยืนยันความต้องการทางธุรกิจ (Requirements) และประสบการณ์ผู้ใช้ (UX) ให้ตกผลึกก่อน

---

## 📲 งานทดสอบระบบแจ้งเตือน Telegram Push (ล่าสุด)
- **คำสั่งผู้ใช้:** 
  1. "ช่วยทดลองยิง push เทเลแกรมมาหาผม"
  2. "ถูกต้องคับ โดยบทบาทบอทตัวนี้ จะเป็นงาน Rider อย่างเดียวคับ จะเอาไว้ให้ Rider ใช้งานผ่านช่องทางนี้"
- **การดำเนินการและผลลัพธ์:**
  1. **สืบค้นและเชื่อมต่อสำเร็จ:** เชื่อมต่อ Telegram Chat ID จริงของผู้ใช้ (`5581598534`, `iGAMER`, `@gamexoo9`) สำเร็จ 100%
  2. **ทดสอบยิง Push:** ยิงข้อความทดสอบสถานะระบบ (Message ID: 6) และข้อเสนองานไรเดอร์พร้อมปุ่มเปิด PWA (Message ID: 7) เข้า Telegram ผู้ใช้สำเร็จเรียบร้อย
  3. **ผูกบัญชีไรเดอร์:** บันทึก `telegram_chat_id = '5581598534'` เข้ากับไรเดอร์ 1 (`สมชาย ขี่เร็ว`, เบอร์ `0891112233`) ในฐานข้อมูล
  4. **ปรับโค้ด Webhook เป็น Rider Bot โดยเฉพาะ:**
     - อัปเดต [`src/app/api/telegram/webhook/route.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/api/telegram/webhook/route.ts)
     - รองรับคำสั่ง `/start` (แสดงสถานะไรเดอร์), `/status`, `/link <เบอร์โทร>`
     - ตรวจสอบชนิดข้อมูลด้วย `tsc --noEmit` ผ่าน 0 errors
- **สถานะ:** ✅ **เสร็จสิ้นสมบูรณ์ 100%** — บอทพร้อมใช้งานสำหรับงานไรเดอร์เต็มรูปแบบ

---

## 🔐 ปรับปรุงการตั้งค่า Environment (.env.local) & Cron Secret
- **คำสั่งผู้ใช้:** `@[.env.local:L101] ช่วยปรับปรุงเนื้อฟหา`
- **การดำเนินการที่ทำ:**
  1. **ปรับปรุง `.env.local` หมวด 11 (Cron Security & External Schedulers):**
     - กำหนดให้มีทั้ง `CRON_SECRET` (ชื่อมาตรฐาน) และ `COUBD_ID` (ชื่อสำรองบน Vercel) ตรงกันด้วยค่า `«REDACTED — ดูค่าจริงจาก .env.local / Vercel env»`
     - เพิ่มคำอธิบายการใช้งานทั้งภาษาไทยและภาษาอังกฤษครอบคลุมทั้ง 2 cron endpoints (`/api/cron/dispatch-timeout` และ `/api/cron/data-retention`)
  2. **ปรับปรุง `.env.local` หมวด 7:**
     - แก้ไขหัวข้อจากเดิมที่เป็น Customer Status Updates เป็น **`Telegram Bot Notification (Rider Operations & Dispatch Bot)`** ให้ตรงกับบทบาทใหม่ที่กำหนด
  3. **เพิ่ม Fallback ในโค้ด API Cron Routes:**
     - อัปเดต [`src/app/api/cron/dispatch-timeout/route.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/api/cron/dispatch-timeout/route.ts) และ [`src/app/api/cron/data-retention/route.ts`](file:///d:/system%20make/Ran-R-HAN/src/app/api/cron/data-retention/route.ts) ให้รองรับ `process.env.CRON_SECRET || process.env.COUBD_ID`
  4. **ตรวจสอบระบบ:**
     - `pnpm tsc --noEmit` ผ่าน 0 errors
     - ทดสอบยิงเรียก Endpoint Production `/api/cron/dispatch-timeout` ด้วย Bearer Secret ได้รับผลลัพธ์ `200 OK` (`ok: true`)
- **สถานะ:** ✅ **เสร็จสิ้นสมบูรณ์ 100%**




