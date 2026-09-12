# RAN-R-HAN — Pre-order System Verification Report (Component H)

> **Document Status:** VERIFIED & ALIGNED WITH PRODUCTION CODE & SCHEMA  
> **Verification Date:** 2026-09-12  
> **Source of Truth:** `supabase/migrations/20260910000001_delivery_system.sql`, `src/lib/delivery-parser.ts`, `src/app/actions/delivery.ts`, `src/app/admin/delivery/preorder`

---

## 1. Executive Summary

ระบบพรีออเดอร์ (Pre-order / Batch Delivery System) ได้รับการตรวจสอบอย่างละเอียดเทียบระหว่าง **Database Schema**, **Production Code (Server Actions & Parser)**, **UI Admin Management**, และ **เอกสารแผนงานเดิม (`docs/zone-delivery-system-plan.md`)**

### ผลการตรวจสอบหลัก:
1. **Schema & Database Integrity:** ตาราง `preorder_rounds` และ `preorder_items` มีโครงสร้างสมบูรณ์ สอดคล้องกับ RLS policies และ foreign key cascades
2. **Comment Parsing Pipeline:** ตัววิเคราะห์ข้อความภาษาไทย (`src/lib/delivery-parser.ts`) สกัดเบอร์โทรศัพท์ (08x/09x/06x/053x), จับคู่จุดรับสินค้าตามความยาวของชื่อ, และแยกจุดสังเกต (`location_note`) ได้อย่างแม่นยำ
3. **Trip Conversion:** `convertPreorderRoundToTripAction` ถ่ายทอดข้อมูลจาก `preorder_items` ไปเป็น `delivery_trip_items` และสร้าง `delivery_trips` ได้ถูกต้อง พร้อมปรับสถานะรอบเป็น `completed`
4. **Docs Drift:** ตรวจพบและบันทึกประเด็นความแตกต่างระหว่างเอกสารระดมความคิดเริ่มต้น กับโค้ดโปรดักชันจริง (เช่น การไม่ลง dependency OCR หนักๆ ใน client แต่ใช้ Copy-Paste Bulk Parser ที่เสถียรกว่า)

---

## 2. Database Schema Verification

### 2.1 ตาราง `preorder_rounds`
สร้างใน migration `20260910000001_delivery_system.sql` (บรรทัดที่ 48-58):
- **ฟิลด์:** `id`, `shop_id`, `title`, `cutoff_at`, `delivery_date`, `delivery_time_window`, `status`, `created_at`, `updated_at`
- **สถานะรอบ (`status`):** `open` (เปิดรับจอง), `closed` (ปิดรับยอด/เตรียมของ), `completed` (แปลงเป็นเที่ยวส่งเรียบร้อยแล้ว)
- **RLS:** มี RLS ป้องกันร้านอื่นเข้าถึง โดยจำกัดเฉพาะ staff/owner ของร้านนั้นๆ (`Shop staff can manage preorder rounds`)

### 2.2 ตาราง `preorder_items`
สร้างใน migration `20260910000001_delivery_system.sql` (บรรทัดที่ 61-74):
- **ฟิลด์:** `id`, `round_id`, `location_id`, `recipient_name`, `recipient_phone`, `location_note`, `items_summary`, `total_amount`, `payment_method`, `payment_status`, `raw_input_text`, `created_at`
- **การเก็บข้อความดิบ (`raw_input_text`):** เก็บเพื่อความโปร่งใสและตรวจสอบความถูกต้องของการ Parse
- **Data Retention:** รองรับการล้างข้อความดิบตามเงื่อนไข PDPA Data Minimization (ผ่าน `src/app/api/cron/data-retention/route.ts` ที่จะเซ็ต `raw_input_text = NULL` หลัง 90 วัน โดยยังคงยอดขายและประวัติออเดอร์ไว้)

---

## 3. Parsing Logic & Text Import Flow

### 3.1 การสกัดเบอร์โทรศัพท์ (`extractThaiPhone`)
- รองรับเบอร์มือถือ `06x`, `08x`, `09x` และเบอร์โทรศัพท์บ้าน/ภูมิภาค `053x` (แม่ฮ่องสอน)
- ตัดขีด ช่องว่าง และอักขระพิเศษออกเป็นตัวเลขล้วน 9-10 หลัก
- นำสตริงเบอร์โทรออกจากข้อความต้นฉบับเพื่อไม่ให้รบกวนการสกัดชื่อสินค้า

### 3.2 การจับคู่จุดรับสินค้า (`matchDeliveryLocation`)
- นำ Master Data จาก `delivery_locations` มาเรียงลำดับตามความยาวชื่อจากมากไปน้อย (`b.name.length - a.name.length`) ป้องกันปัญหาสถานที่ชื่อสั้นแย่งจับคู่ทับชื่อยาว
- มีระบบ Keyword Aliases ในตัวสำหรับสถานที่สำคัญในแม่ฮ่องสอน:
  - โรงพยาบาล: `รพ.`, `รพ.ศรีสังวาลย์`, `ศรีสังวาลย์`
  - กาดเทศบาล: `กาดเทศบาล`, `ตลาดเทศบาล`
  - หนองจองคำ: `หนองจองคำ`

### 3.3 การแยกชื่อ, สินค้า, และจุดสังเกต (`parseFacebookComment`)
- แยก Token ด้วยเว้นวรรค คำแรกเป็นชื่อผู้รับ (Default: `'ลูกค้า'`)
- ตรวจจับคีย์เวิร์ดจุดสังเกต (`noteKeywords = ['ข้าง', 'ซอย', 'หน้าตู้', 'ประตู', 'ชั้น', 'เบอร์']`)
- **การปรับปรุงความแม่นยำ:** ใช้วิธีค้นหาตำแหน่งคีย์เวิร์ดที่ปรากฏ **ก่อนสุดในข้อความ (`earliestIdx`)** เพื่อให้ข้อความจุดสังเกตและรายการสินค้าถูกแบ่งอย่างถูกต้องสมบูรณ์

### 3.4 Bulk Parsing (`parseBulkComments`)
- รองรับการ Paste คอมเมนต์จำนวนหลายบรรทัดพร้อมกัน
- กรองบรรทัดว่างหรือสั้น (< 4 ตัวอักษร) ออกอัตโนมัติ
- คืนค่าเป็น Array พร้อมแสดงใน Preview Modal ให้ร้านค้าตรวจสอบ/แก้ไขก่อนกดยืนยันบันทึก

---

## 4. Pre-order to Delivery Trip Conversion Workflow

ขั้นตอนเมื่อร้านค้าปิดรับพรีออเดอร์และต้องการออกรถส่งสินค้า:

1. ร้านค้ากด **"แปลงเป็นเที่ยวส่ง (Convert to Trip)"** ในหน้า `/admin/delivery/preorder/[id]`
2. Action `convertPreorderRoundToTripAction(roundId, customTripName)` ทำงาน:
   - ตรวจสอบสิทธิ์ความเป็นเจ้าของร้านของผู้ใช้ปัจจุบัน
   - ดึงรายการ `preorder_items` ทั้งหมดของรอบนั้น
   - สร้างเที่ยวส่งใหม่ใน `delivery_trips` โดยอ้างอิง `trip_date` จาก `delivery_date` ของรอบ และตั้งค่าสถานะเริ่มต้นเป็น `'draft'`
   - แปลงรายการพรีออเดอร์เข้าสู่ `delivery_trip_items`:
     - `order_reference_id` ชี้ไปยัง `preorder_items.id`
     - `location_id` ถูกส่งต่อไปยังจุดรับสินค้า
     - `delivery_status` เริ่มต้นที่ `'pending'`
   - ปรับสถานะของ `preorder_rounds` เป็น `'completed'`
   - ทำ `safeRevalidate` เส้นทาง `/admin/delivery/trips` และ `/admin/delivery/preorder`
3. ร้านค้าสามารถเปิดหน้าแผนที่ Leaflet ใน `/admin/delivery/trips/[id]` เพื่อดูจุดส่งและจำนวนสินค้าตามแต่ละจุดรับ

---

## 5. Docs Drift Analysis & Reconciliation

| ประเด็น | เอกสารเดิม (`docs/zone-delivery-system-plan.md`) | สภาพความเป็นจริงใน Codebase / Schema | ข้อสรุป / การ Reconciliation |
| :--- | :--- | :--- | :--- |
| **OCR / Tesseract.js** | ระบุว่าจะทำ OCR รองรับ Screenshot จาก Facebook In-app Browser | ไม่มีการติดตั้ง `tesseract.js` ใน `package.json` โค้ดจริงใช้ Copy-Paste Bulk Text Parser | **ยึด Production Code:** การใช้ Text Parser มีความแม่นยำสูงกว่า ไม่สิ้นเปลือง bundle size และไม่พบปัญหา memory บนมือถือ สำหรับ Phase 1 Pilot ถือว่าเพียงพอและเสถียร |
| **ความสัมพันธ์กับ Rider System** | ระบุว่า "ไม่มีระบบ Rider ในเฟสนี้ (เก็บไว้ก่อน)" | มีการพัฒนาระบบ On-Demand Rider สำหรับ Instant Delivery แยกต่างหาก | **ระบบทำงานคู่ขนานกันอย่างชัดเจน:**<br>1. **Instant Food Delivery:** ทำงานผ่าน `orders` -> `rider_jobs` -> `riders` (มี Rider Dispatch, GPS, Rate Card 15 THB)<br>2. **Batch Pre-order / Zone Delivery:** ทำงานผ่าน `preorder_rounds` -> `delivery_trips` (ร้านค้าหรือพนักงานร้านส่งตามรอบเวลาแบบรวมจุดรับ) |
| **สถานะรอบพรีออเดอร์** | ระบุ `open / closed / completed` | ตาราง `preorder_rounds` มี `check (status in ('open', 'closed', 'completed'))` | **ตรงกัน 100%** |
| **การจัดกลุ่มแผนที่ (Leaflet Grouping)** | ระบุการพล็อตหมุดตามจุดรับสินค้า | มีฟังก์ชัน `groupTripItemsByLocation` คำนวณจุดรับ แสดงจำนวน Delivered vs Pending และมี Fallback Coordinates (19.3005, 97.9678) กรณีจุดรับไม่ระบุ | **ตรงกันและทำงานได้สมบูรณ์** |

---

## 6. Test Suite & Verification Results

ชุดการทดสอบครอบคลุมใน `test/delivery.test.ts`:
1. `Facebook Comment Parser (Single & Bulk)`:
   - ตรวจจับเบอร์โทรศัพท์, จุดรับสินค้าที่ตรงกับ Master Data, ชื่อลูกค้า และรายการสินค้า (PASS)
   - จัดการกรณีไม่พบจุดรับสินค้าในข้อความ (Fallback to null location) (PASS)
   - การแยกวิเคราะห์ข้อความหลายบรรทัดพร้อมกัน (Bulk Parsing) (PASS)
2. `Delivery Trip Items Grouping for Map Visualization`:
   - การจัดกลุ่มรายการตามจุดรับสินค้า และคำนวณจำนวนส่งสำเร็จ/รอดำเนินการ (PASS)
3. `Delivery Zod Validations`:
   - ตรวจสอบความถูกต้องของ Input Schema สำหรับ Location, Trip, และ Preorder Round (PASS)
4. `Preorder to Delivery Trip Mapping & Edge Cases`:
   - ตรวจสอบการแยก `location_note` ด้วยคีย์เวิร์ดจุดสังเกตแบบลำดับก่อนหลังในข้อความจริง (PASS)
   - ตรวจสอบการจัดกลุ่มสถานที่เมื่อ `location_id` เป็น null หรือไม่ทราบพิกัด (PASS)
   - ตรวจสอบความครบถ้วนของ Schema Mapping ระหว่าง Preorder Item และ Delivery Trip Item (PASS)

**ผลลัพธ์การทดสอบ:** 10/10 PASS (ระยะเวลาทำงาน < 500ms)
