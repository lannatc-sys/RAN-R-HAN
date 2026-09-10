# Rider Delivery & Dispatch System Architecture — Phase 1

> สรุปจากการ Brainstorming + Grill-Me Session วันที่ 10 ก.ย. 2569
> เป็นเอกสารอ้างอิงหลักสำหรับการพัฒนาระบบ Rider ใน Phase 1

---

## 1. ภาพรวมสถาปัตยกรรม (Architecture Overview)

### 1.1 หลักการออกแบบหลัก

| หลักการ | รายละเอียด |
| --- | --- |
| **Deterministic Core** | Dispatch Engine ทำงานด้วยกฎ Rule-based ที่คาดเดาได้ 100% ไม่ใช้ AI ในการตัดสินใจจ่ายงาน |
| **Server-Authoritative** | Server เป็น Single Source of Truth ทุก State Change ต้องผ่านการยืนยันจาก Server เท่านั้น |
| **Human-in-the-Loop** | การจ่ายเงินทุกรอบต้องผ่านการอนุมัติจากเจ้าหน้าที่ก่อน ระบบไม่โอนเงินอัตโนมัติ 100% |
| **Privacy by Design** | ไม่เก็บ GPS ถาวรทุก Ping, ไม่เปิด Public Link ของเอกสารส่วนตัว, เป็นไปตาม PDPA |
| **Cost-aware API Design** | ใช้ PostGIS กรองก่อนเรียก Routing API เสมอ เพื่อควบคุมค่าใช้จ่าย |

### 1.2 Stack เทคโนโลยี

```
┌─────────────────────────────────────────────────┐
│                   OPERATIONAL CORE               │
│  Supabase (PostgreSQL + PostGIS + Realtime       │
│            + Auth + Edge Functions + Storage)    │
└─────────────────────────────────────────────────┘
           ↕ Archive Pipeline (Scheduled Worker)
┌─────────────────────────────────────────────────┐
│                  COLD ARCHIVE                    │
│         Google Drive 5TB (Private, ACL)          │
└─────────────────────────────────────────────────┘
           ↕ Read-only Supporting Layer
┌─────────────────────────────────────────────────┐
│               AI SUPPORTING LAYER                │
│   Google Workspace / Drive Gemini                │
│   (Document/Archive assistance only)              │
│   (ห้ามอยู่ใน Dispatch หรือ Payment Critical Path)│
└─────────────────────────────────────────────────┘
```

---

## 2. Assignment Strategy — Sequential Direct Offer

```
Dispatch Engine
      ↓
คัด Candidate Riders (PostGIS + Score)
      ↓
เลือก Best Rider อันดับ 1
      ↓
ส่ง Offer ให้ไรเดอร์ 1 คน
      ↓
นับถอยหลัง Timeout (30–45 วินาที)
      ↓
┌─────────────┬───────────────┐
│   ACCEPT    │  REJECT/TIMEOUT│
↓             ↓
รับงาน     Re-dispatch → Candidate คนถัดไป
             (บันทึก Reject/Timeout Log)
```

### Offer State Machine

```
PENDING_OFFER
      ↓
OFFERED (Countdown เริ่มนับ)
      ↓
┌──────────────┬──────────────┐
│   ACCEPTED   │  REJECTED /  │
│              │  TIMED_OUT   │
```

**Audit Trail:** บันทึกทุก Event — `Offer`, `Accept`, `Reject`, `Timeout`, `Re-dispatch` พร้อม Timestamp และ Rider ID

---

## 3. Dispatch Timing — KDS Stage-based Trigger

### หลักการ Just-In-Time (JIT) Dispatch

> เวลาที่ Rider ถึงร้านควรใกล้เคียงกับเวลาที่อาหารพร้อม เพื่อไม่ให้ไรเดอร์รอที่ร้านนาน

```
Order Confirmed
      ↓
Merchant ระบุ Estimated Ready Time
      ↓
KDS เปลี่ยนสถานะเป็น "Cooking"
      ↓
Dispatch Engine เริ่มประเมิน
      ↓
ตรวจ Rider + Road ETA (Mapbox)
      ↓
เทียบ ETA กับ Estimated Ready Time
      ↓
Direct Offer → Best Rider
```

### Merchant Override (Fast-track)

- หากร้านกด **"Ready"** (สถานะ `READY`) ก่อนเวลาคาด → ระบบเร่งกระบวนการ Dispatch ทันที
- บันทึก `Actual Ready Time` ทุกครั้ง เพื่อนำไปวิเคราะห์ความแม่นยำของ Preparation Time

---

## 4. Candidate Filtering — PostGIS + Mapbox Matrix

### 4.1 Service Area vs. Rider Search Radius

| ระบบ | คำนิยาม | ผู้กำหนด |
| --- | --- | --- |
| **Service Area** | Polygon/Boundary พื้นที่ที่ลูกค้าสามารถสั่งได้ | Superadmin |
| **Rider Search Radius** | รัศมีค้นหาไรเดอร์รับงาน | Dispatch Engine (Dynamic) |

> หากลูกค้าอยู่นอก Service Area → ปฏิเสธทันที พร้อมแจ้งว่า "อยู่นอกพื้นที่ให้บริการ"

### 4.2 Dynamic Radius Expansion

```
Initial Search: 3 km
      ↓
ตรวจ Online + Available Riders
      ↓
ไม่พอเกณฑ์? → ขยายเป็น 6–8 km
      ↓
PostGIS คัดกรอง → Top 5 Candidates
      ↓
Mapbox Matrix → Road ETA
      ↓
Dispatch Score → Best Rider
```

### 4.3 Dispatch Score (ลำดับความสำคัญ)

1. Ready Time / ความพร้อมของอาหาร
2. Road ETA (ระยะทางจริงจาก Mapbox)
3. Route Continuity (สำหรับงานซ้อน)
4. Fairness (กระจายงานกรณี ETA ใกล้เคียงกัน)
5. Rider Performance Score

---

## 5. Fallback — Auto-Retry Loop with Backoff

```
Candidate ชุดแรกปฏิเสธทั้งหมด
      ↓
รอ 2–3 นาที (รอไรเดอร์ที่กำลังส่งงานอื่นเสร็จ)
      ↓
สแกนหา Candidate ใหม่
      ↓
Re-dispatch (สูงสุด 3 รอบ)
      ↓
ครบ 3 รอบยังไม่มีไรเดอร์?
      ↓
แจ้งเตือนร้านค้า + ลูกค้าทันที
```

---

## 6. Rider Mobile Client — Cross-Platform Native App

### แพลตฟอร์ม

- **เทคโนโลยี:** Flutter หรือ React Native (ตัดสินใจ Phase ต่อไป)
- **Supabase Integration:** Supabase Mobile SDK (Auth, Realtime Channel, REST)

### ความสามารถที่ต้องการ

| ฟีเจอร์ | รายละเอียด |
| --- | --- |
| **Background Location Service** | ส่ง GPS ต่อเนื่องแม้พับหน้าจอขณะขับขี่ |
| **High-Priority Push Notification** | FCM / APNs สำหรับ Offer Alert — ต้องดัง ไม่ถูก Battery Saver บล็อก |
| **Offline Graceful Failure** | แจ้ง Rider เมื่อสัญญาณหลุด, บล็อกการรับงานใหม่, Sync สถานะเมื่อกลับ Online |

### Online-First Principle (Phase 1)

> ทุก Action สำคัญ (รับงาน / จบงาน / ส่ง POD) ต้องได้รับการยืนยันจาก Server ก่อนถือว่าสำเร็จ
> ไม่อนุญาตให้รับงานแบบ Offline เด็ดขาดใน Phase 1
> Rider ต้องมี **Active Work Session** (กด Start Work แล้วยังไม่ Close System) จึงจะถือว่าอยู่ในสถานะ "พร้อมรับงาน" — ไม่มี Work Session เปิดอยู่ = ไม่ถูกเสนองาน ไม่ว่า App จะเปิดอยู่หรือไม่ก็ตาม

---

## 6.1 Rider Legal Relationship Boundary

Architecture นี้ตั้งใจให้ Rider เป็น **ผู้รับงานอิสระ (Independent Contractor)** ตาม Business Model ของ Platform แต่สถานะทางกฎหมายต้องพิจารณาจากสัญญาและการควบคุมการทำงานจริงร่วมกัน ไม่ใช่จากชื่อเรียกเพียงอย่างเดียว

ข้อกำหนดทางเทคนิค เช่น Offer Timeout, Reject/Timeout Logging, Online-First, Rescue Dispatch และ Performance Score ต้องถูกทบทวนร่วมกับ Rider Agreement และแนวปฏิบัติจริงก่อน Production เพื่อหลีกเลี่ยงการควบคุมที่อาจขัดกับโครงสร้างความสัมพันธ์ที่ตั้งใจไว้

---

## 7. GPS Telemetry — Work Session-based Tracking

### Scope: จับ GPS ตลอด Work Session ไม่ใช่เฉพาะตอนมี Order

```
OFFLINE (ยังไม่กด Start Work)
      ↓ ไม่จับ GPS
START WORK
      ↓ เริ่ม GPS Session ใหม่ (work_session_id)
ระหว่าง Session
      ├── Idle (ไม่มี Order ที่กำลังทำ)  → Low-frequency Ping
      └── Active Job (มี Order ที่กำลังทำ) → High-frequency Ping
CLOSE SYSTEM
      ↓ หยุดจับ GPS ทันที ปิด Session
```

> จับ GPS ตั้งแต่ Rider กด **Start Work** ของวันจนกด **Close System** — ไม่ใช่แค่ช่วงที่มี Order Active เท่านั้น (แทนที่โมเดลเดิมที่ผูกความถี่กับ Online/Idle/In-Transit)

| สถานะระหว่าง Work Session | ความถี่ส่งพิกัด | เงื่อนไขเพิ่มเติม |
| --- | --- | --- |
| **Idle** (มี Session เปิด, ไม่มี Order) | Low-frequency (ค่าจริงรอกำหนด — ดู §17) | หรือเมื่อเคลื่อนที่เกินระยะที่กำหนด (ไม่ส่งซ้ำหากจอดนิ่ง) |
| **Active Job** (มี Order ที่กำลังทำ) | High-frequency (ค่าจริงรอกำหนด — ดู §17) | เพื่อ KDS ร้านและลูกค้าเห็น Live Tracking |
| **ไม่มี Work Session เปิดอยู่** | หยุดส่งทันที | ปกป้องความเป็นส่วนตัวตาม PDPA |

### Database Strategy

- อัปเดตพิกัดแบบ **Overwrite** ลงตาราง `rider_current_locations` (1 Row ต่อ 1 Rider)
- ทุก Ping ผูกกับ **`work_session_id`** ของ Session ที่กำลังเปิดอยู่ เพื่อระบุว่าพิกัดล่าสุดเกิดในช่วงเวลาทำงานใด
- **ไม่** บันทึกทุก Ping เป็น Historical Log (ป้องกัน Database Bloat) — `work_session_id` ใช้ผูกบริบท ไม่ใช่เก็บ Log รายพิกัด
- หาก Phase ต่อไปต้องการ GPS History เพื่อ Audit ให้แยกเป็นระบบ GPS Audit Log ต่างหาก

---

## 8. Batch / Multi-Order Dispatch — Conservative Batching

### Phase 1: สูงสุด 2 ออเดอร์ / 1 Rider

```
Order 1 ─┐
          ├→ Route Evaluation ─→ ผ่าน → Batch 2 Orders
Order 2 ─┘        │
                   └→ ไม่ผ่าน → แยกงาน (Single Order)
```

### เงื่อนไขการรวมงาน

| เงื่อนไข | รายละเอียด |
| --- | --- |
| **ขอบเขตร้านค้า** | ร้านเดียวกัน หรือร้านอยู่ในคลัสเตอร์ใกล้เคียงกันมาก |
| **Route Continuity** | จุดส่งลูกค้าต้องอยู่ในทิศทาง/เส้นทางเดียวกัน |
| **SLA ลูกค้าคนแรก** | Detour เพิ่มต้องไม่เกินเกณฑ์ที่กำหนด (Config) |
| **ยังไม่เปิด** | 3 ออเดอร์ต่อเที่ยว / Batch ข้ามร้านแบบอิสระเต็มรูปแบบ |

### Dynamic Sequence (ยืดหยุ่นตามหน้างาน)

```
ตัวอย่าง: ร้านที่ 2 ยังไม่พร้อม

Rider → รับ Order 1 → ส่งลูกค้า 1 → กลับรับ Order 2 → ส่งลูกค้า 2
```

- ระบบสามารถสลับลำดับ รับ → ส่ง ได้ตามความพร้อมของร้านจริง
- ห้ามล็อกลำดับตายตัวแบบ: ร้าน 1 → ร้าน 2 → ลูกค้า 1 → ลูกค้า 2 เสมอไป

---

## 9. Proof of Delivery (POD) & Storage Lifecycle

### 9.1 Tiered Lifecycle

```
Rider ส่งสำเร็จ
      ↓
ถ่ายรูป POD อัปโหลดขึ้น Supabase Storage (Hot)
      ↓
Order เสร็จสิ้น → ช่วง Hot Period (7–14 วัน*)
      ↓
Archive Worker (Scheduled Job)
      ↓
ย้ายไฟล์ → Google Drive 5TB (Private Folder: /archive/YYYY/MM/DD/)
      ↓
ลบไฟล์จาก Supabase Storage
      ↓
เก็บ gdrive_file_id / archive_path ไว้ใน Supabase DB
```

> *ระยะ Hot Period จะกำหนดหลังจากตรวจสอบนโยบาย Retention, PDPA, และระยะเวลาเคลมของแพลตฟอร์มจริง

### 9.2 Access Control (PDPA Compliance)

```
Customer / Restaurant / Admin
          ↓
      Platform API
          ↓
 ตรวจสิทธิ์ (Auth + Role)
          ↓
 Google Drive Archive (Private)
```

> **ห้าม** เปิด Public Link ของ Google Drive โดยเด็ดขาด
> ทุกการเข้าถึงไฟล์ POD ต้องผ่านระบบ Platform เพื่อตรวจสอบสิทธิ์ก่อนเสมอ
>
> **Cross-border / International Processing:** หากข้อมูลส่วนบุคคลถูกโอนหรือประมวลผลออกนอกประเทศไทย ต้องมีการตรวจสอบฐานทางกฎหมายและมาตรการที่ใช้ให้สอดคล้องกับ PDPA และข้อกำหนดของผู้ให้บริการก่อนใช้งานจริง

### 9.3 POD Metadata Watermark (Mandatory)

ทุกภาพ POD ต้องมี Metadata ที่ระบบสร้างให้อัตโนมัติ (ห้าม Rider แก้ไขเอง):

| Field | รายละเอียด |
| --- | --- |
| `server_received_at` | **Timestamp จาก Server (Source of Truth)** — ไม่ใช้นาฬิกามือถือ |
| `order_id` | รหัส Order |
| `rider_id` | รหัสไรเดอร์ |
| `event_type` | ประเภทเหตุการณ์ (DELIVERED / UNREACHABLE_DROP / PICKUP) |
| `gps_lat`, `gps_lng` | พิกัด GPS ขณะถ่ายภาพ |

### 9.4 Data Subject Rights & Retention

ระบบต้องมีกระบวนการรองรับคำขอของ Data Subject ตามสิทธิที่ใช้ได้กับข้อมูลและฐานการประมวลผล เช่น การเข้าถึง แก้ไข ลบ ระงับ/คัดค้าน หรือขอให้ดำเนินการอื่นตามกฎหมาย โดยต้องมีการตรวจสอบตัวตน สิทธิ์ ข้อยกเว้น และ Audit Trail ทุกครั้ง

- กำหนด **Retention Period** ของ POD/GPS/เอกสารแต่ละประเภทก่อน Production
- ไม่กำหนดระยะเวลาเก็บข้อมูลจากตัวเลขตัวอย่างในเอกสารนี้โดยลำพัง
- ก่อนลบข้อมูลต้องตรวจสอบว่ามีเหตุจำเป็นตามกฎหมาย ข้อพิพาท การเคลม หรือหน้าที่เก็บรักษาหรือไม่
- การเก็บ/ลบ/Archive ต้องสามารถตรวจสอบย้อนหลังได้

---

## 10. Edge Cases & Incident Handling

### 10.1 Mid-Trip Breakdown (รถเสียกลางทาง)

```
Rider กดแจ้งเหตุฉุกเฉิน "รถเสีย"
      ↓
Dispatch ไรเดอร์คนที่ 2 ในละแวก (Rescue Dispatch)
      ↓
Rider 2 ไปรับอาหารต่อจากจุดรถเสีย
      ↓
ส่งถึงมือลูกค้า
```

**Split Payout:**

| ไรเดอร์ | ค่าตอบแทน |
| --- | --- |
| **Rider 1** (คนรถเสีย) | ค่ารอบตามสัดส่วน GPS ระยะทางที่วิ่งมาจริง |
| **Rider 2** (คนกู้ภัย) | ค่ารอบระยะทางที่เหลือ + **Rescue Bonus** (จาก Rider Pool) |

### 10.2 Customer Unreachable Protocol (ลูกค้าติดต่อไม่ได้)

```
Rider ถึงจุดหมาย
      ↓
ติดต่อลูกค้าไม่ได้ → กดแจ้งในแอป
      ↓
ระบบส่ง Push Notification ฉุกเฉินให้ลูกค้า
      ↓
นับถอยหลัง 10 นาที
      ↓
ยังไม่ตอบ?
      ↓
ถ่ายรูป POD หลักฐาน + วางอาหารในจุดปลอดภัย
      ↓
กดยืนยัน "Delivered (Unreachable)" → จบงาน
      ↓
สถานะการจัดส่งถือว่าสำเร็จตามเงื่อนไขที่ประกาศไว้ล่วงหน้า โดยยังคงสิทธิ์ตามกฎหมายและกระบวนการร้องเรียน/เคลมที่ใช้บังคับ
```

### 10.3 Race Condition / Concurrent Accept

- ใช้ Database Transaction + Row-Level Lock (`SELECT ... FOR UPDATE`) ป้องกัน Double Assignment
- **Grace Period 2–3 วินาที:** รองรับ Network Latency ฝั่งมือถือ
- หาก `ACCEPT` มาถึง Server หลังจาก Re-dispatch ไปคนที่ 2 แล้ว → ปฏิเสธ Accept ของคนแรก พร้อมแจ้ง Error บนแอป

### 10.4 Road Detour & Distance Discrepancy

- หากระยะทาง GPS จริงเบี่ยงเบนจาก Mapbox Estimate เกิน **20%** หรือเกิน **2 กม.**
- ระบบ Flag Order เข้าสถานะ `PENDING_REVIEW` ใน Daily Settlement Draft
- Admin ตรวจสอบเส้นทาง GPS ก่อนอนุมัติ — หากเป็นทางเลี่ยงจริงให้ปรับเพิ่มค่ารอบให้ไรเดอร์

---

## 11. Rate Card & Financial Architecture

### 11.1 Base Rate (Phase 1 — Locked)

| รายการ | ค่า |
| --- | --- |
| Base Rate | **15 บาท / 5 กม.แรก** |
| ร้านค้าจ่าย | 50% (7.50 บาท) |
| ลูกค้าจ่าย | 50% (7.50 บาท) |
| Vehicle Baseline | มอเตอร์ไซค์ 150 cc |

> ค่า Rider Payout จริงต่อกิโลเมตรและค่าเกิน 5 กม. ให้เก็บเป็น Configuration Parameter เมื่อมีต้นทุนจริงพร้อม

### 11.2 Unified Ledger Flow

```
Customer Payment
      ↓
Payment Provider
      ├── ค่าสินค้า → ร้านค้า (Settlement รอบเดียว)
      │               └── หักส่วนค่าจัดส่งของร้านอัตโนมัติ
      │
      └── ค่าจัดส่ง (Delivery Fee)
             ├── Rider Payout (ตาม Rate Card)
             └── Rider Pool (ส่วนต่าง → กองกลาง)
```

> **ร้านค้าไม่ต้องจ่ายเงินสดให้ไรเดอร์เองหน้างาน** ระบบจัดการ Settlement ให้ทุกฝ่ายในรอบเดียว
>
> Payment Provider เป็นผู้รับ/จัดการเงินตามโครงสร้างที่ตรวจสอบแล้ว ส่วน Platform ไม่ควรถือเงินของหลายฝ่ายไว้เอง เว้นแต่ได้รับการตรวจสอบและอนุญาตตามกฎหมายที่เกี่ยวข้อง

### 11.3 Rider Pool (กองกลาง)

- เงินส่วนต่างระหว่าง Delivery Fee ที่เรียกเก็บกับ Rider Payout จริง **ตามโครงสร้างธุรกิจที่กำหนด**
- โครงสร้างทางกฎหมายของกลุ่ม Rider, บัญชีกลาง, อำนาจของประธานกลุ่ม และผู้มีสิทธิ์สั่งจ่าย **ต้องได้รับการยืนยันก่อน Production**
- Platform ไม่ควรอ้างเพียงคำว่า “ไม่ใช่เงินของ Platform” หากในทางปฏิบัติ Platform ยังควบคุมหรือถือเงินอยู่
- ใช้สำหรับ Rescue Bonus / สวัสดิการ / เหตุฉุกเฉินตามกติกาที่ได้รับอนุมัติ
- รายการรับ-จ่ายทุกครั้งต้องตรวจสอบได้ผ่าน Ledger และมีผู้มีอำนาจอนุมัติตามกติกาของกลุ่ม

### 11.4 Special Conditions

| เหตุการณ์ | การจัดการ |
| --- | --- |
| **Rain Surcharge** | แสดง Popup แจ้งลูกค้ายืนยันก่อน → เงินส่วนเพิ่มไปเป็น Rain Bonus ให้ไรเดอร์โดยตรง |
| **งานซ้อน (Batch)** | คำนวณตามเส้นทางจริง — ห้ามนำค่ารอบเต็มของแต่ละ Order มาบวกกันโดยอัตโนมัติ |
| **Post-Accept Cancellation** | แยกตามเหตุแห่งการยกเลิก — ไม่ใช้ Blanket Rule เดียว: (1) เหตุจากฝั่งร้าน/แพลตฟอร์ม (ของหมด, ร้านปิดกะทันหัน, Dispatch ผิดพลาด) → เข้าเงื่อนไขคืนค่าจัดส่ง; (2) เหตุจากลูกค้าเปลี่ยนใจหลัง Rider รับงานแล้ว → ไม่คืนค่าจัดส่งตามหลักการ (Rider เสียเวลา/ระยะทางไปแล้ว) — **⚠️ Legal Review Required:** ถ้อยคำจริงใน T&C ที่ลูกค้าเห็นก่อนสั่งซื้อต้องผ่านทนายก่อนเผยแพร่ ห้ามใช้ข้อความนี้ตรงตัว |

---

## 11.5 Accounting / Tax Review Gate

ก่อน Production ต้องตรวจสอบอย่างน้อย:

- ลักษณะเงินได้ของ Rider และภาระ/กลไก **หักภาษี ณ ที่จ่าย** ที่อาจเกี่ยวข้อง
- เอกสาร/หลักฐานการจ่ายเงินและหนังสือรับรองภาษีที่เกี่ยวข้อง
- VAT / ภาษี / รายได้ของ Platform ตามโมเดลธุรกิจจริง
- การบันทึกบัญชีของ Rider Pool และผู้รับผิดชอบทางบัญชี

**Architecture นี้ไม่กำหนดอัตราภาษีไว้ล่วงหน้า** เพราะขึ้นกับข้อเท็จจริงของสัญญาและสถานะผู้รับเงิน ต้องให้ผู้ทำบัญชี/ที่ปรึกษาภาษีตรวจยืนยัน

---

## 12. Daily Settlement Workflow

### Settlement State Machine

```
DRAFT → REVIEWING → APPROVED → EXECUTING → COMPLETED

กรณีพบข้อผิดพลาด:
REVIEWING → EXCEPTION → แก้ไข/Adjustment → REVIEWING (วนรอบใหม่)
```

### Flow รายวัน

```
สิ้นวัน (ปิดรอบ)
      ↓
คำนวณ Ledger อัตโนมัติ
      ↓
สร้าง Daily Settlement Draft (DRAFT)
      ↓
Flag Order ที่มีปัญหา → PENDING_REVIEW
      ↓
แจ้งเตือน Finance / Superadmin
      ↓
Admin Review (REVIEWING)
      ↓
Admin กด Approve (APPROVED)
      ↓
ส่ง Settlement Instruction → Payment Provider (EXECUTING)
      ↓
ยืนยัน Transfer สำเร็จ (COMPLETED)
```

### Daily Settlement Report ต้องประกอบด้วย

- จำนวน Order ทั้งหมด
- Delivery Fee รวม / แยกตามร้าน
- Rider Payout รวม / แยกตามไรเดอร์
- Rider Pool รวม
- รายการอ้างอิง Order ทุกรายการ
- ยอดสะสม
- รายการ Exception / Detour ที่รอ Review

---

## 13. AI Supporting Layer — Google Workspace / Drive Gemini

> **กฎเหล็ก:** Gemini ไม่ใช่ API/Service ของ Platform และไม่มีส่วนในการตัดสินใจ Dispatch หรือสั่ง Execute / Approve การจ่ายเงิน

การใช้ Gemini จำกัดอยู่ใน **Google Drive / Google Workspace** สำหรับข้อมูลที่ได้รับอนุญาตให้เข้าถึง และต้องไม่เปลี่ยนสถานะทางธุรกิจของระบบโดยอัตโนมัติ

```
Order → Dispatch Engine → Rider
              ↑
        Gemini ไม่แตะเส้นทาง

Settlement → Admin Review → Approve → Payment
                    ↑
          Gemini ช่วยอ่าน/สรุปเท่านั้น
```

### 13.1 Operational Digest

- ช่วยสรุปข้อมูล/รายงานที่จัดเก็บใน Google Drive
- ช่วยสรุปแนวโน้ม Ready Time, Dispatch Bottleneck, Reject/Timeout และ Rider Pool เมื่อข้อมูลถูกจัดทำเป็นเอกสาร/รายงานแล้ว
- ไม่แก้ Configuration หรือสั่งงานระบบเอง

### 13.2 Admin Document Assistant

- ค้นหาและสรุปเอกสาร/Archive ใน Google Drive ตามสิทธิ์
- ช่วยสรุป Exception Case เพื่อประกอบการตรวจของ Admin
- ไม่มีสิทธิ์ Approve Settlement, Execute Payment หรือเปลี่ยนสถานะ Order/Rider

### 13.3 AI Data Boundary

- **ไม่ใช้ Gemini API ใน Platform**
- ห้ามนำข้อมูลส่วนบุคคลออกไปยัง AI service เพิ่มเติมนอกขอบเขต Google Workspace ที่องค์กรอนุมัติ โดยไม่มีการตรวจสอบฐานทางกฎหมายและมาตรการคุ้มครองที่เกี่ยวข้อง
- ผลลัพธ์จาก Gemini เป็น Supporting Output ต้องมีมนุษย์ตรวจสอบก่อนนำไปใช้กับการตัดสินใจที่มีผลกระทบต่อบุคคล

---

## 14. Rider Performance & Restaurant Metrics

### 14.1 Rider Performance Score (รายเดือน)

- Completion Rate
- On-time Delivery Rate
- Reject Rate / Cancel Rate
- Customer Rating
- ปัญหาระหว่างการส่ง

> Score เป็นองค์ประกอบรองใน Dispatch Decision — ไม่ใช่ตัวตัดสิทธิ์

### 14.2 Restaurant Monthly Performance

- จำนวน Order รวม
- Average Preparation Time
- Ready-time Accuracy (Estimated vs Actual)
- Pickup Delay (ไรเดอร์รอนานแค่ไหนหลัง Ready)
- Cancellation Rate

---

## 15. Data Architecture & Audit

### 15.1 ตารางหลักที่ต้องมี

| ตาราง | วัตถุประสงค์ |
| --- | --- |
| `orders` | ข้อมูลออเดอร์หลัก |
| `dispatch_offers` | ประวัติ Offer / Accept / Reject / Timeout ทุกรายการ |
| `rider_current_locations` | พิกัดปัจจุบันของไรเดอร์ (Overwrite, 1 Row/Rider) |
| `rider_work_sessions` | Session เปิด/ปิดงานของไรเดอร์ (`start_work_at`, `close_system_at`, `work_session_id` ที่ GPS Ping และ Dispatch อ้างอิง) |
| `delivery_events` | Event Log: Pickup, Delivered, Unreachable, Breakdown |
| `pod_uploads` | Metadata ของภาพ POD (path, server_received_at, event_type) |
| `daily_settlements` | Settlement State Machine รายวัน |
| `settlement_line_items` | รายละเอียดการจ่ายเงินรายออเดอร์ |
| `rider_pool_ledger` | รายการรับ-จ่ายเงินกองกลาง Rider Pool |

### 15.2 Event Audit Log (บันทึกทุก Event)

- Order Created / Confirmed
- Dispatch Offer Sent / Accepted / Rejected / Timed Out
- Re-dispatch Triggered
- KDS Status Changed (Cooking / Ready Soon / Ready)
- Rider Departed / Arrived at Restaurant / Picked Up
- Delivery Attempted / Completed / Unreachable
- POD Uploaded
- Mid-trip Breakdown Reported
- Rescue Dispatch Triggered
- Settlement Status Changed

---

## 16. Principles Locked for Phase 1

```
✅ ไม่ยิง Routing API ก่อน Spatial Filtering (PostGIS)
✅ ไม่ส่งงานให้ไรเดอร์หลายคนพร้อมกัน (Sequential Only)
✅ ไม่ใช้ AI ใน Core Dispatch Decision
✅ ไม่โอนเงินอัตโนมัติโดยไม่มีคน Approve
✅ ไม่บันทึก GPS ทุก Ping เป็น Log ถาวร
✅ ไม่เปิด Public Link ของ Google Drive
✅ ไม่อนุญาตให้รับงานแบบ Offline
✅ ไม่รวมงานเกิน 2 ออเดอร์ / ไรเดอร์ใน Phase 1
✅ ไม่เปิด Batch ข้ามร้านแบบอิสระเต็มรูปแบบใน Phase 1
✅ Server Timestamp เป็น Source of Truth เสมอ (ไม่ใช้นาฬิกามือถือ)
✅ GPS Tracking = Work Session Based — เริ่มเมื่อ START_WORK และหยุดเมื่อ CLOSE_SYSTEM เท่านั้น (ไม่ใช่ผูกกับ Order)
```

---

## 17. Open Items / Parameters และ Legal Gates ที่ยังต้องกำหนด

| รายการ | สถานะ |
| --- | --- |
| Hot Period ของ POD | ต้องกำหนดจาก Retention / Claim / Legal basis |
| GPS Ping Interval ของ `Idle` | รอกำหนดค่าจริง (Battery vs ความสด ของข้อมูล) |
| GPS Ping Interval ของ `Active Job` | รอกำหนดค่าจริง (ความถี่ Live Tracking) |
| เงื่อนไข `Start Work` / `Close System` | รอกำหนด UX/Business Rule (เช่น Auto Close หลังไม่มีความเคลื่อนไหวนานแค่ไหน) |
| การจัดการกรณี App ถูกปิด/Background ระหว่าง Work Session | รอกำหนด — Session ควรค้างไว้, Auto-close, หรือแจ้งเตือน Rider ก่อนตัดสถานะ |
| Cross-border / International Processing ของ Google Workspace/Drive | **Legal Review Gate** |
| Data Subject Rights Flow | **ต้องออกแบบก่อน Production** |
| ค่า Rider Payout ต่อ กม. เกิน 5 กม. | รอข้อมูลต้นทุนจริง |
| Rescue Bonus จำนวนเงิน | รอมติกลุ่ม Rider + โครงสร้างกองกลาง |
| Rain Surcharge จำนวนเงิน | รอมติ Policy ของ Platform |
| Offer Timeout Duration (30 หรือ 45 วิ) | รอ A/B Testing |
| Detour Threshold (%/กม.) | รอ Baseline Data |
| Flutter vs React Native | รอการประเมินทีม Dev |
| Offer Grace Period (2 หรือ 3 วิ) | รอ Latency Testing |
| Rider Pool legal structure / ผู้มีอำนาจบัญชีกลาง | **Blocker ก่อน Production** |
| Payment Provider / Money Flow / custody | **Blocker ก่อน Production** |
| Rider Agreement + Independent Contractor review | **Blocker ก่อน Production** |
| WHT / VAT / Accounting treatment | **Blocker ก่อน Production** |
| Cancellation / Refund / Safe Drop wording | **Blocker ก่อน T&C Production** |

### 17.1 Legal Review Boundary

เอกสารนี้เป็น **Architecture + Legal Issue-Spotting Baseline** ไม่ใช่ความเห็นทางกฎหมายขั้นสุดท้าย

รายการที่ระบุเป็น Blocker ต้องได้รับการตรวจและยืนยันโดยผู้เชี่ยวชาญกฎหมาย/บัญชีที่เกี่ยวข้องก่อนเปิดใช้งานจริง

*เอกสารนี้สร้างขึ้นจากการ Brainstorming และ Grill-Me Session ของทีม*
*Base Rate, Assignment Strategy และ AI Boundary Rule เป็น Architecture/Business Decisions ที่ล็อกไว้; การเปลี่ยนต้องผ่านการอนุมัติทีมอย่างเป็นทางการ*
