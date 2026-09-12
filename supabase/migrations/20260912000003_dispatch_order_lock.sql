-- Migration: 20260912000003_dispatch_order_lock.sql
-- วัตถุประสงค์: ป้องกันไม่ให้ order เดียวกันมี dispatch_offers ที่ status = 'offered'
--              พร้อมกันมากกว่า 1 แถว (สองคำขอ dispatch พร้อมกันสำหรับ order เดียวกัน
--              ต้องผ่าน app-level guard ได้ทั้งคู่ในทางทฤษฎี — index นี้ปิดช่องว่างที่ระดับ DB)
--
-- วันที่: 2026-09-12

-- "At most one active offer per order" — มาตรฐาน Postgres pattern สำหรับ
-- partial unique index บน status column เดียวกับที่ dispatch_offers ใช้ transition
-- แบบ compare-and-swap อยู่แล้ว (ดู respond_to_dispatch_offer, expire_dispatch_offers)
create unique index if not exists uq_dispatch_offers_one_active_per_order
  on public.dispatch_offers(order_id)
  where status = 'offered';
