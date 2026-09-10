# Rider Dispatch & Assignment Architecture — Phase 1

## 1. Purpose
ระบบจ่ายงานไรเดอร์สำหรับแพลตฟอร์ม Food Delivery โดยเน้นความเป็นกลาง คุมต้นทุน Routing API และรองรับการทำงานของร้านอาหาร/KDS ที่มีอยู่แล้ว

## 2. Assignment Strategy
ใช้ **Sequential Direct Offer**

1. คัด Candidate Riders
2. เลือก Best Rider ตาม Dispatch Logic
3. ส่ง Offer ให้ Rider เพียง 1 คน
4. รอ Accept ภายใน Timeout ที่ระบบกำหนด
5. หาก Reject หรือ Timeout → Re-dispatch ไป Candidate ถัดไป
6. บันทึกประวัติ Offer / Accept / Reject / Timeout

## 3. Dispatch Trigger
ใช้ **KDS Stage-based Trigger + Ready Time**

- KDS เป็น Trigger หลัก
- ร้านระบุ Estimated Ready Time
- ระบบใช้ Ready Time ประกอบการเลือกจังหวะ Dispatch
- Actual Ready Time ต้องถูกเก็บไว้เพื่อวิเคราะห์ภายหลัง
- เมื่ออาหาร Ready แต่ยังไม่มี Rider → เร่งกระบวนการ Dispatch

หลักการ:
> เวลาที่ Rider ถึงร้านควรใกล้เคียงกับเวลาที่อาหารพร้อม

## 4. Candidate Filtering
ใช้ PostGIS กรอง Candidate ก่อนเรียก Routing API

Baseline:
- Initial Radius: 3 km
- หาก Candidate น้อยกว่าเกณฑ์ → ขยายเป็น 6–8 km
- พิจารณาเฉพาะ Rider ที่ Online + Available/Idle
- ส่ง Candidate สูงสุด 5 คนไปคำนวณ ETA

## 5. Service Area
Service Area ของลูกค้าแยกจาก Rider Search Radius

Superadmin สามารถ:
- กำหนดพื้นที่ให้บริการ
- ใช้ Radius หรือ Polygon ตามการออกแบบระบบ
- แก้ไขพื้นที่ผ่านแผนที่
- เปิด/ปิดพื้นที่
- กำหนด Configuration ของ Dispatch Search แยกจาก Service Area

ถ้าตำแหน่งลูกค้าอยู่นอก Service Area → ไม่อนุญาตให้สั่งและแจ้งว่าอยู่นอกพื้นที่ให้บริการ

## 6. Routing
ใช้ Mapbox เป็น Routing/ETA provider ในระยะเริ่มต้น

PostGIS:
- Spatial filtering
- ลดจำนวน Candidate

Mapbox:
- Road Distance
- ETA
- ตรวจสอบเส้นทางจริง

หลักการ:
> ไม่ใช้ระยะเส้นตรงเป็นระยะทางคิดเงินหรือเป็นตัวแทนเส้นทางจริง

## 7. Fairness
ระบบต้องเป็นกลางกับ Rider

เงื่อนไขพื้นฐาน:
- Rider ที่ Online + Available มีสิทธิ์แข่งขัน
- ไม่ให้ Offline Rider เสียเปรียบจาก Fairness Calculation
- ไม่ชดเชย Rider เพียงเพราะไม่ได้ออนไลน์
- Fairness เป็นองค์ประกอบรอง ไม่ override ETA/Ready Time โดยไม่มีเหตุผล

ตัวอย่าง:
หาก Rider หลายคนมี ETA ใกล้เคียงกัน → ใช้ Fairness เพื่อช่วยกระจายงาน

## 8. Rider Performance Score
Rider Score เป็นองค์ประกอบหนึ่งของ Dispatch Decision แต่ไม่ใช่ตัวตัดสิทธิ์

ข้อมูลพฤติกรรมอาจประกอบด้วย:
- Completion
- On-time
- Reject
- Cancel
- Customer Rating
- ปัญหาการส่ง

การประเมินเชิง Performance ให้สรุปเป็นรายเดือน

## 9. Restaurant Performance
เก็บข้อมูลร้านเพื่อสร้าง Monthly Restaurant Performance เช่น:
- จำนวน Order
- Average Preparation Time
- Ready-time Accuracy
- Pickup Delay
- Cancellation

ข้อมูลดิบยังเก็บเพื่อ Audit/ตรวจสอบ แต่ Dispatch Engine ไม่จำเป็นต้องนำรายละเอียดจุกจิกทุกเหตุการณ์มาคำนวณตลอดเวลา

## 10. Batch / Multi-order Dispatch
งานซ้อนต้องใช้ **Route Continuity / Route Optimization**

ระบบต้องประเมิน:
- ระยะทางเพิ่ม
- เวลาเพิ่ม
- Ready Time
- เวลารอร้าน
- ETA ลูกค้า
- ลำดับการรับและส่ง

อนุญาตกรณีเช่น:
Rider → ร้าน 1 → ร้าน 2 (ยังไม่พร้อม) → ลูกค้า 1 → ร้าน 2 → ลูกค้า 2

ห้ามใช้กฎตายตัวว่าต้อง:
ร้าน 1 → ร้าน 2 → ลูกค้า 1 → ลูกค้า 2

หลัก:
> งานซ้อน = การเพิ่มงานบน Trip เดิมโดยต้องประเมินเส้นทางและภาระงานจริง

## 11. Dispatch Decision Priority
ลำดับแนวคิด:

1. Ready Time / ความพร้อมของอาหาร
2. Road ETA / ระยะทางจริง
3. Route Continuity สำหรับงานซ้อน
4. Fairness
5. Rider Performance Score

## 12. Data & Audit
ควรบันทึก Event ที่จำเป็นต่อการตรวจสอบ:
- Order
- Offer
- Accept
- Reject
- Timeout
- Re-dispatch
- Restaurant Ready
- Rider Pickup
- Delivery Complete
- Route/ETA ที่ใช้ตัดสินใจ

ข้อมูล Operational ที่จำเป็นต่อการทำงานเก็บในระบบหลัก ส่วนข้อมูลประวัติ/Archive สามารถแยกไป Storage ระยะยาวตามสถาปัตยกรรมของโครงการ

## 13. Principle
- ไม่ยิง Routing API ก่อน Spatial Filtering
- ไม่ส่งงานหลายคนพร้อมกันใน Phase 1
- ไม่ใช้ AI API สำหรับ Core Dispatch
- AI ไม่จำเป็นต่อการตัดสินใจจ่ายงานใน Phase 1
- ใช้ Mapbox เป็น Routing provider เท่านั้น
