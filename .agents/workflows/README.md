# 🧭 Workflows & Engineering Standards (RAN-R-HAN)

ศูนย์รวมกระบวนการทำงานและมาตรฐานการพัฒนา (Engineering Workflows & Operating Guidelines) สำหรับ AI Agents และทีมพัฒนาของโปรเจกต์ **RAN-R-HAN**

---

## 📑 รายการ Workflow ทั้งหมด

- [ran-r-han.md](file:///d:/system%20make/Ran-R-HAN/.agents/workflows/ran-r-han.md) (`/ran-r-han`): แผนปฏิบัติการและมาตรฐานการพัฒนาระบบร้านอาหารท้องถิ่นแม่ฮ่องสอน (SaaS/PWA)

---

## 🎯 มาตรฐานและเสาหลัก 5 ประการ (The 5 Core Pillars)

ทุก Workflow ในโฟลเดอร์นี้ต้องยึดถือและปฏิบัติตามมาตรฐาน 5 ข้อดังต่อไปนี้อย่างเคร่งครัด:

### 1. 🏛️ Source of Truth (แหล่งความจริงหลัก)
- **ห้ามเดาหรือสมมุติโครงสร้างข้อมูลเอง**: อ้างอิงจากเอกสารแกนหลักและฐานข้อมูลจริงเสมอ
- **ลำดับความสำคัญของเอกสาร**:
  1. [docs/KNOWLEDGE.md](file:///d:/system%20make/Ran-R-HAN/docs/KNOWLEDGE.md) — สถาปัตยกรรม, Tech Stack, กฎเหล็ก และ File Structure
  2. [docs/Blueprint.md](file:///d:/system%20make/Ran-R-HAN/docs/Blueprint.md) — ขอบเขตงาน (Scope) และโจทย์ทางธุรกิจของร้านค้าในเทศบาลเมืองแม่ฮ่องสอน
  3. [docs/router-map.md](file:///d:/system%20make/Ran-R-HAN/docs/router-map.md) — แผนผังเส้นทางและสิทธิ์การเข้าถึงทั้งหมด
  4. `supabase/migrations/` — Database DDL, RLS Policies และ RPC Functions จริง
  5. [docs/TODO.md](file:///d:/system%20make/Ran-R-HAN/docs/TODO.md) — แผนงานและข้อตกลงที่ตัดสินใจไปแล้ว

---

### 2. 🔄 State (สถานะและการควบคุมวงจรการทำงาน)
- **Order Lifecycle**:
  - `pending` (รอชำระ/รอยืนยัน) ➔ `confirmed` (ยืนยันแล้ว) ➔ `cooking` (กำลังปรุง) ➔ `served` (พร้อมรับที่ร้าน) ➔ `completed` (เสร็จสิ้น)
  - ยกเลิกได้จาก `pending` และ `confirmed` ➔ `cancelled`
  - บังคับใช้การเปลี่ยนสถานะผ่าน `isValidOrderStatusTransition()` ใน [`src/lib/orders.ts`](file:///d:/system%20make/Ran-R-HAN/src/lib/orders.ts) เสมอ
- **Payment State**:
  - `pending` ➔ `verified` (ตรวจสลิปอัตโนมัติด้วย SlipOK หรือกดรับเงินสดหน้าร้าน) ➔ `failed`
- **Device & Service State**:
  - `has_printer = false` (ไม่มีเครื่องพิมพ์บิล ห้ามสร้าง flow บังคับพิมพ์)
  - `device_mode = 'multi_device'` (รองรับหลายเครื่อง)
  - `kds_pin = '0000'` (PIN 4 หลักสำหรับล็อกหน้าจอครัว)

---

### 3. 📦 Artifact (ชิ้นงานและผลลัพธ์ที่จับต้องได้)
- **คลังเอกสาร ([docs/](file:///d:/system%20make/Ran-R-HAN/docs/))**:
  - มีสารบัญหลักที่ [docs/README.md](file:///d:/system%20make/Ran-R-HAN/docs/README.md) และเอกสารสเปกครบถ้วน
- **โค้ดต้นทาง ([src/](file:///d:/system%20make/Ran-R-HAN/src/))**:
  - Next.js 15 PWA App Router พร้อม Dark Mode
  - Shared Libraries (`orders.ts`, `kds.ts`, `crypto.ts`, `promptpay.ts`, `thai-errors.ts`, `auth-helpers.ts`)
- **ชุดทดสอบคุณภาพ ([test/](file:///d:/system%20make/Ran-R-HAN/test/))**:
  - Unit Tests 4 โมดูลหลัก (`order.test.ts`, `payment.test.ts`, `auth.test.ts`, `kds.test.ts`)
  - Integration & Smoke Tests (`smoke-test.ts`, `e2e-test.ts`, `superadmin-test.ts`)

---

### 4. 🛡️ Quality Gate (เกณฑ์การตรวจรับคุณภาพและความปลอดภัย)
ก่อนสรุปว่าการทำงานเสร็จสิ้น ต้องผ่านเกณฑ์ดังนี้ทั้งหมด:
1. **Unit Test Gate**: `pnpm run test:unit` ผ่าน 38/38 รายการ (100%)
2. **Smoke Test Gate**: `pnpm run test:smoke` ผ่านทุกฟังก์ชัน
3. **Build Gate**: `pnpm build` คอมไพล์ผ่านสมบูรณ์ ปราศจาก Type Error
4. **Security Gate**:
   - เข้ารหัส API Key ด้วย AES-256-GCM
   - ป้องกันสลิปซ้ำด้วยรหัส PostgreSQL Error 23505
   - ดึง Secret จาก Environment Variables เท่านั้น ห้าม Hardcode
5. **Git Safety Gate**: **ห้ามรัน `git push` โดยเด็ดขาด** หากไม่ได้รับความยินยอมจากผู้ใช้
6. **Local Policy Gate**: ห้ามมี flow พิมพ์บิล และใช้ Web Push Notification ฟรี 100%

---

### 5. 🧠 Memory (ระบบบันทึกความจำและวิวัฒนาการสกิล)
- **SkillClaw Engine**:
  - Background Daemon ทำงานที่ `http://127.0.0.1:30005`
  - ซิงก์ทักษะและบันทึกประวัติลง `C:\Users\GAME\.skillclaw\dashboard.db`
  - ตรวจสอบสถานะ: `skillclaw status`
- **Project Knowledge Base**:
  - บันทึกการตัดสินใจ ข้อจำกัดทางเทคนิค และวิธีแก้ปัญหาที่เคยเกิดขึ้นจริงลงใน [docs/KNOWLEDGE.md](file:///d:/system%20make/Ran-R-HAN/docs/KNOWLEDGE.md)
- **Git Commit Memory**:
  - ใช้ Conventional Commits เพื่อบันทึกประวัติการเปลี่ยนแปลงที่ตรวจสอบย้อนหลังได้ชัดเจน
