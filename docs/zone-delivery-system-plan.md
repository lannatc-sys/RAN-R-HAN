# แผนการพัฒนา: ระบบเขตและการส่งของ (Zone & Delivery System)

> สรุปจากบทสนทนา Brainstorming วันที่ 10 ก.ย. 2569

---

## สิ่งที่ตัดสินใจแล้ว (Decisions Made)

### ความจริงหน้างาน (Ground Truth)
- ลูกค้า **พิมพ์คอมเมนต์สั่งใต้โพสต์ Facebook** เหมือนเดิม — **ห้ามบังคับให้กดลิงก์หน้าเว็บ**
- แม่ค้าส่งเองหรือจ้างไรเดอร์นอก (ยังไม่มีระบบ Rider ในเฟสนี้)
- การส่งเป็น **รอบเวลา (Batch)** ไม่ใช่ On-demand (เช่น รอบบ่าย 14:00 น.)
- **ไม่ต้องคำนวณของเผื่อ** แม่ค้าตัดสินใจเองตามประสบการณ์
- **ไม่ต้องติดตามตำแหน่งคนส่ง (Live Tracking)** — ยังไม่เคาะระบบส่งอาหาร
- **ไม่ใช้ Google Maps API Key** — ใช้พิกัดคงที่จาก Google Earth + Leaflet.js ฟรี

---

## 2 ระบบที่แยกกันอย่างเด็ดขาด

```
ระบบที่ 1: ร้านส่งเอง + แผนที่จุดรับสินค้า
ระบบที่ 2: พรีออเดอร์
```

ทั้งสองระบบ **ทำงานอิสระต่อกัน** แต่ใช้ฐานข้อมูลสถานที่ร่วมกัน

---

## ระบบที่ 1: ร้านส่งเอง + แผนที่จุดรับสินค้า

### เป้าหมาย
รู้ว่า **จุดรับไหน มีลูกค้ากี่คน** และ **ต้องขับไปทางไหน**

### DB Tables (เพิ่มใหม่)

**`delivery_locations`** — ตัวแปรสถานที่หลัก (Master Data กลาง)
```
id, name, zone_name, lat, lng, sort_order, is_active
```
> ค่า lat/lng ดึงมาจาก Google Earth ครั้งเดียว ไม่มีวันเปลี่ยน

**`delivery_trips`** — เที่ยวส่งของ
```
id, shop_id, trip_name, trip_date,
cutoff_at,              ← เวลาปิดรับออเดอร์
delivery_time_window,   ← เช่น "14:00 น. เป็นต้นไป"
status (draft/in_transit/completed)
```

**`delivery_trip_items`** — รายการส่งรายบุคคลในแต่ละเที่ยว
```
id, trip_id, location_id,
recipient_name, recipient_phone,
location_note,          ← จุดสังเกต เช่น "ข้าง 7-11"
items_summary,          ← เช่น "ช่อสวย 3 กก."
order_reference_id,     ← nullable (เผื่อดึงจากระบบพรีออเดอร์)
delivery_status (pending/delivered)
```

### UI สำหรับแม่ค้า (Merchant Tool เท่านั้น)

**หน้ากรอกออเดอร์เข้าเที่ยวส่ง:**
- ฟอร์มกรอกด่วน: ชื่อ, เบอร์, ของ, เลือกจุดรับ → พิกัด GPS เด้งมาเองทันที
- *(เฟสนี้: แม่ค้ากรอกเองตามที่อ่านคอมเมนต์ Facebook)*

**หน้าแผนที่เที่ยวส่ง (Delivery Map):**
- แผนที่ Leaflet.js + OpenStreetMap (ฟรี 100%)
- ปักหมุดเฉพาะจุดที่มีลูกค้าในเที่ยวนั้น
- หมุดแสดงจำนวนคน → กดดูรายชื่อ/เบอร์โทร/จุดสังเกต
- ปุ่ม **📞 โทรหาลูกค้า** (click-to-call: `tel:...`)
- ปุ่ม **🚗 เปิด Google Maps นำทาง** (deep link URL ฟรี ไม่ใช้ API)
- Checkbox ✓ ส่งถึงมือแล้ว

### สิ่งที่ตัดออก
- ❌ ไม่คำนวณค่าน้ำมัน/ระยะทาง
- ❌ ไม่มีระบบ Rider
- ❌ ไม่มี Live Tracking

---

## ระบบที่ 2: พรีออเดอร์

### เป้าหมาย
แม่ค้าเปิดรอบสั่งจอง รับคอมเมนต์จาก Facebook → กรอกข้อมูลลูกค้าเข้าระบบ → ได้ยอดสรุปสำหรับวางแผน

### โฟลว์จริง
```
แม่ค้าโพสต์เฟส → ลูกค้าคอมเมนต์สั่ง (เหมือนเดิม)
→ แม่ค้ากรอกข้อมูลจากคอมเมนต์เข้าระบบ (ไม่บังคับลูกค้ากดลิงก์)
→ ระบบสรุปยอดและจุดส่ง
```

### DB Tables (เพิ่มใหม่)

**`preorder_rounds`** — รอบพรีออเดอร์
```
id, shop_id, title, cutoff_at, delivery_date,
delivery_time_window, status (open/closed/completed)
```

**`preorder_items`** — รายการสั่งจองในรอบนั้น
```
id, round_id, location_id (FK → delivery_locations),
recipient_name, recipient_phone,
location_note, items_summary, total_amount,
raw_input_text   ← บันทึกคอมเมนต์ดิบไว้อ้างอิง
```

### UI สำหรับแม่ค้า
- เปิดรอบ / ตั้งเวลาปิดรับยอด
- ฟอร์มกรอกออเดอร์ตามคอมเมนต์: ชื่อ, เบอร์, รายการ, ราคา, จุดรับ, จุดสังเกต
- สรุปยอดรวมของรอบนั้น (เตรียมของขึ้นรถ)

### เชื่อมกับระบบที่ 1
- เมื่อปิดรอบพรีออเดอร์ → ส่งรายการ `preorder_items` ไปสร้างเป็น `delivery_trip_items` ในระบบที่ 1 โดยอัตโนมัติ

---

## Technology Stack (ไม่เพิ่มใหม่)
- **DB**: Supabase PostgreSQL (เพิ่ม tables ใหม่เข้าไป)
- **Frontend**: Next.js 15 (App Router) — ที่มีอยู่แล้ว
- **แผนที่**: Leaflet.js + OpenStreetMap → ฟรี ไม่ใช้ API Key
- **Text Parsing**: TypeScript ใน Next.js — ไม่ต้องลง Package ใหม่
- **GPS**: ค่าคงที่จาก Google Earth — ไม่ต้องใช้ Google Maps API เลย

---

## Open Questions (ยังไม่ได้ตัดสินใจ)
1. **Rider System**: ยังหาทางออกไม่ได้ → เก็บไว้ก่อน ไม่ทำในเฟสนี้

---

## สิ่งที่ตัดสินใจแล้ว (เพิ่มเติม)

### 2. Text Parser — ทำทั้ง 2 วิธี
ต้องรองรับ 2 วิธีเพราะ **Facebook In-app Browser บล็อกการ Copy Text**:

| ช่องทางที่ใช้ | วิธีนำเข้าข้อมูล |
| :--- | :--- |
| **Facebook In-app Browser** | Screenshot แล้วอัปโหลดรูป → ระบบอ่านข้อความจากรูป (OCR) |
| **Browser ทั่วไป** (Chrome/Safari) | คลุมดำคอมเมนต์ → Copy → Paste → ระบบ Parse ข้อความ |

**OCR (กรณีส่งรูป Screenshot):**
- ใช้ Tesseract.js (ฟรี รันใน Browser ได้เลย) หรือ Google Cloud Vision API
- อ่านข้อความจากรูป → ส่งผลลัพธ์ผ่าน Text Parser ชุดเดิม

**Text Parser (กรณี Copy-Paste):**
- เขียนด้วย TypeScript ใน Next.js (ไม่ต้องลง Package เพิ่ม)
- Regex สกัดเบอร์โทร 10 หลัก
- Match ชื่อสถานที่กับ `delivery_locations` Master Data
- สกัดสินค้าและจำนวน
- ส่วนที่เหลือ → `location_note` (จุดสังเกต)
- แสดง Preview Table ให้แม่ค้าตรวจก่อน Confirm

### 3. ระบบชำระเงินพรีออเดอร์ — มีให้เลือกทั้ง 2 แบบ
- **PromptPay**: โอนล่วงหน้า + แนบสลิป (ใช้ระบบตรวจสลิปที่มีอยู่แล้วใน RAN-R-HAN)
- **เงินสด (COD)**: จ่ายเงินสดตอนรับของ

---

## ลำดับการพัฒนาที่แนะนำ
1. สร้าง `delivery_locations` Master Data + หน้า Admin จัดการสถานที่
2. สร้าง `delivery_trips` + `delivery_trip_items` + หน้ากรอกออเดอร์
3. หน้าแผนที่ Leaflet ปักหมุดตามพิกัด + ปุ่มโทร + ปุ่มนำทาง
4. สร้าง `preorder_rounds` + `preorder_items` + หน้ากรอกพรีออเดอร์
5. เชื่อมพรีออเดอร์ → สร้าง delivery_trip โดยอัตโนมัติ
