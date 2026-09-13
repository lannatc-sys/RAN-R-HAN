# Project Brief

## Subject

เพิ่มระบบกำหนดขอบเขตพื้นที่บริการของร้านและบังคับใช้กับลูกค้าและไรเดอร์ใน RAN-R-HAN โดยใช้พิกัดจริงและเวลาฝั่งเซิร์ฟเวอร์เป็นแหล่งความจริง

## Goal

ออกแบบร่วมกับ Claude จากหลักฐานใน repository แล้วดำเนินการเพิ่มหน้าตั้งค่าเขตบริการ การบล็อกออเดอร์นอกเขต และการเตือน/ปิด session ไรเดอร์เมื่ออยู่นอกเขตเกิน 15 นาที พร้อม regression tests และเอกสารการใช้งาน

## Desired Output And Audience

- Deliverable: ข้อสรุปสถาปัตยกรรม แผน implementation โค้ด migration/API/UI/cron ที่จำเป็น และผลทดสอบ
- Audience: เจ้าของโปรเจกต์ ผู้ดูแลร้าน และผู้พัฒนาที่จะ deploy/ทดสอบภาคสนาม

## Context

ระบบเป็น Next.js 15 + Supabase/PostgreSQL แบบ multi-tenant มีข้อมูลพิกัดร้าน/ลูกค้าและระบบ Rider อยู่แล้วบางส่วน การตัดสินใจต้องยึด schema/migrations/actions/tests จริง ป้องกันการข้ามข้อจำกัดด้วยการเรียก API โดยตรง และไม่ใช้เวลา/ตัวจับเวลาจากหน้าเว็บเป็น authority

## Constraints And Scope Boundaries

- Include: เขตบริการต่อร้าน, การตั้งค่าผ่าน admin, validation ลูกค้าก่อนสร้างออเดอร์, rider geofence warning/deactivation 15 นาที, server/DB timestamps, auditability, tests
- Exclude: live route tracking, คำนวณ ETA, หลาย polygon ซับซ้อน, deploy production, เปลี่ยนช่องทาง LINE/Telegram นอกเหนือจากข้อความ/เหตุการณ์ที่ระบบเดิมรองรับ
- Timeline: เริ่ม implementation ได้ทันทีหลังข้อสรุป Codex/Claude โดยทำเป็น thin slices
- Budget/compute: ใช้ Claude หนึ่ง planning pass แบบ read-only และใช้ Codex ดำเนินการต่อเพื่อรักษาโควตา
- Technology/geography: Next.js 15, TypeScript strict, Supabase PostgreSQL/PostGIS; pilot ร้านเดียวแต่ต้องคง tenant isolation

## Success Criteria

- ลูกค้านอกเขตไม่สามารถสร้างออเดอร์ได้แม้เรียก boundary โดยตรง และได้รับข้อความไทยตามที่ผู้ใช้กำหนด
- ร้านกำหนด/แก้ขอบเขตบริการจากหน้า admin ได้โดยไม่เปิดเผยสิทธิ์ข้ามร้าน
- ไรเดอร์นอกเขตได้รับ timestamp เตือนที่คงอยู่และถูกปิด session หลังครบ 15 นาทีโดย server-side enforcement; กลับเข้าเขตก่อนครบเวลายกเลิกสถานะได้ และหลังถูกปิดสามารถเริ่มงานใหม่เมื่ออยู่ในเขต
- Migration เป็น additive, tests/typecheck ผ่านตามข้อจำกัดเครื่อง และไม่มีการแตะงานค้างที่ไม่เกี่ยวข้อง

## Authorization Boundaries

- Local modifications authorized: yes — เฉพาะเอกสาร แผน migration server actions/API cron UI และ tests ของ service-area enforcement
- Network research authorized: no — ใช้เอกสารและโค้ดใน repository เป็นหลัก
- Paid tools authorized: no
- Credentialed private systems authorized: yes — Claude CLI ที่ติดตั้งอยู่สำหรับ read-only planning pass ตามคำขอผู้ใช้เท่านั้น
- External writes/deploy/publish/message actions authorized: no

## Workflow Controls

- Profile: compact
- Human review: final-only
- Preferred language and tone: ภาษาไทย กระชับ เน้นผลและข้อจำกัดที่ตรวจสอบได้
- Additional resource limits: Claude หนึ่งรอบสำหรับหลักฐาน/ข้อเสนอ จากนั้น Codex เป็นผู้รวมแผน ลงมือ และทบทวน

## Human Review Requirements

ต้องทบทวน tenant authorization, database enforcement, server timestamp และ race conditions ของ rider timeout ก่อนอนุมัติ stage gate; ไม่ deploy หรือแก้ข้อมูล production ใน workflow นี้
