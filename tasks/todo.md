# Preorder Implementation Tasks

## ต้องทำก่อนเปิดใช้ (P0)

- [ ] Task 1 — เพิ่ม feature flag และกำหนด lifecycle/cutoff contract
- [ ] Task 2 — ซ่อม `/admin/delivery/preorder/new` ให้ใช้งานครบเส้นทาง
- [ ] Checkpoint A — Safety gate, typecheck และ create-round flow ผ่าน
- [ ] Task 3 — บังคับสถานะ, cutoff, validation และ bulk limit ทุก mutation
- [ ] Task 4 — ปิดช่องโหว่ลบข้อมูลข้ามร้าน
- [ ] Task 5 — ทำ preorder-to-trip conversion แบบ atomic/idempotent
- [ ] Checkpoint B — Security, retry และ rollback tests ผ่าน
- [ ] Task 6 — ทำ payment lifecycle พร้อม authorization/audit
- [ ] Task 7 — ทำ lifecycle UI ให้ตรงกับกฎฝั่ง server
- [ ] Task 8 — เพิ่ม critical-path E2E และ readiness check
- [ ] Checkpoint C — Go/No-Go review และเปิดเฉพาะร้านทดลอง

## ควรทำหลังเปิดทดลอง (P1/P2)

- [ ] Task 9 — เพิ่ม summary และ duplicate detection
- [ ] Task 10 — เพิ่ม notifications และ observability ที่ไม่เก็บ PII
- [ ] Task 11 — ทำ PDPA retention และ operational runbook

รายละเอียด acceptance criteria, verification, dependencies และไฟล์ที่เกี่ยวข้องอยู่ใน `tasks/plan.md`
