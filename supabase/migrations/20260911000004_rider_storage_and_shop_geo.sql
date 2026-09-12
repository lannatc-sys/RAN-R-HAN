-- ==============================================================================
-- MIGRATION: 20260911000004_rider_storage_and_shop_geo.sql
-- เพิ่มพิกัดร้าน (จุดรับอาหาร) + Storage bucket สำหรับ Proof of Delivery
-- อ้างอิง: docs/03-rider-system-architecture.md §4 (Candidate Filtering), §9 (POD)
-- ==============================================================================

-- 1. พิกัดร้าน — ใช้เป็นจุดศูนย์กลางในการค้นหาไรเดอร์ (Pickup Point)
alter table public.shops
  add column if not exists shop_lat double precision,
  add column if not exists shop_lng double precision;

-- 2. Storage bucket สำหรับภาพ POD (Private — ห้าม Public Link ตาม §9.2)
insert into storage.buckets (id, name, public)
values ('pod-uploads', 'pod-uploads', false)
on conflict (id) do nothing;

-- 3. Storage RLS — path format: pod/{shop_id}/{order_id}/{timestamp}_{event}.{ext}
drop policy if exists "Rider can upload POD to own shop folder" on storage.objects;
create policy "Rider can upload POD to own shop folder"
  on storage.objects for insert
  with check (
    bucket_id = 'pod-uploads'
    and (storage.foldername(name))[1] = 'pod'
    and public.is_rider_of_shop(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "Rider can read own shop POD" on storage.objects;
create policy "Rider can read own shop POD"
  on storage.objects for select
  using (
    bucket_id = 'pod-uploads'
    and (storage.foldername(name))[1] = 'pod'
    and public.is_rider_of_shop(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "Shop staff can read POD" on storage.objects;
create policy "Shop staff can read POD"
  on storage.objects for select
  using (
    bucket_id = 'pod-uploads'
    and (storage.foldername(name))[1] = 'pod'
    and public.has_shop_access(((storage.foldername(name))[2])::uuid)
  );
