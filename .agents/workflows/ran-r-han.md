# 🧭 RAN-R-HAN Workflow & Execution Guide

มาตรฐานการปฏิบัติการและการส่งมอบงานของระบบ **RAN-R-HAN**

---

## 📋 กฎเหล็กการส่งมอบงาน (Handoff Rule)
- **ต้องอัปเดตไฟล์ [`HANDOFF.md`](file:///d:/system%20make/Ran-R-HAN/HANDOFF.md) และ [`docs/HANDOFF.md`](file:///d:/system%20make/Ran-R-HAN/docs/HANDOFF.md) ทุกครั้ง** ที่มีการพัฒนาเสร็จสิ้น หรือมีการแก้บั๊กสำคัญ
- เนื้อหาใน `HANDOFF.md` ต้องระบุ:
  1. สรุปสถานะภาพรวมของโปรเจกต์
  2. สิ่งที่พัฒนาและแก้ไขล่าสุด (พร้อมลิงก์ไฟล์ที่เกี่ยวข้อง)
  3. ผลการทดสอบ Quality Gates (`pnpm run test:unit`, `pnpm test`, `pnpm build`)
  4. คำแนะนำเรื่อง Credentials / Environment
  5. งานถัดไปที่สามารถทำต่อได้ทันที (Next Steps)

---

## 🏛️ มาตรฐาน 5 เสาหลัก
1. **Source of Truth:** อ้างอิงจาก `docs/KNOWLEDGE.md`, `docs/Blueprint.md`, `docs/router-map.md`, และ Schema Migration จริงเสมอ
2. **State:** บังคับใช้ Order Transition ผ่าน `isValidOrderStatusTransition()`
3. **Artifact:** อัปเดตเอกสารและโค้ดให้สอดคล้องกัน
4. **Quality Gate:** ผ่าน Unit test, Smoke test, และ Build 100% ก่อนจบงาน
5. **Memory:** บันทึกความรู้ลง `docs/KNOWLEDGE.md` และซิงก์กับ SkillClaw daemon
