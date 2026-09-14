-- ------------------------------------------------------------------------------
-- โครงขั้นต่ำเลียนแบบ Supabase สำหรับฐานข้อมูลทดสอบแบบใช้แล้วทิ้งเท่านั้น
--
-- migrations ของโปรเจกต์อ้างถึงของที่ Supabase เตรียมไว้ให้ (schema auth/storage/extensions,
-- role authenticated/anon/service_role, auth.uid(), auth.role()) ฐานข้อมูล postgres เปล่า
-- ไม่มีของพวกนี้ `node scripts/run-db.js` จึงพังตั้งแต่ไฟล์แรกด้วย schema "auth" does not exist
-- ไฟล์นี้เติมให้พอรัน migrations และ test/service-area-postgres.integration.cjs ได้
--
-- **ห้ามรันกับฐานข้อมูลจริง** ใช้กับคอนเทนเนอร์ที่พร้อมทิ้งเท่านั้น
-- ------------------------------------------------------------------------------

-- guard กันรันผิด connection string โดยไม่ตั้งใจ
-- ไฟล์นี้มี drop extension ... cascade ถ้าหลุดไปโดนฐานข้อมูลจริงคือข้อมูลหาย
-- เงื่อนไข: ชื่อฐานข้อมูลต้องสื่อว่าเป็นของทิ้ง และต้องยังไม่มีตาราง shops
do $guard$
begin
  if current_database() !~ '(test|tmp|temp|scratch|disposable|fresh)' then
    raise exception
      'REFUSING TO RUN: ฐานข้อมูล % ไม่ได้ชื่อแบบใช้แล้วทิ้ง shim นี้ลบ postgis แบบ cascade',
      current_database();
  end if;

  if to_regclass('public.shops') is not null then
    raise exception
      'REFUSING TO RUN: ฐานข้อมูล % มีตาราง public.shops อยู่แล้ว shim ต้องรันกับฐานข้อมูลเปล่าก่อน migrations',
      current_database();
  end if;
end;
$guard$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

-- อิมเมจ postgis/postgis ติดตั้ง postgis ไว้ใน public แต่โปรเจกต์อ้าง extensions.geography
-- เหมือนบน Supabase และ postgis ไม่รองรับ ALTER EXTENSION ... SET SCHEMA
-- จึงต้องลบแล้วสร้างใหม่ ทำได้เฉพาะบนฐานข้อมูลเปล่าก่อนรัน migrations เท่านั้น
drop extension if exists postgis_tiger_geocoder cascade;
drop extension if exists postgis_topology cascade;
drop extension if exists fuzzystrmatch cascade;
drop extension if exists postgis cascade;
create extension postgis with schema extensions;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- Supabase มี extensions อยู่ใน search_path เริ่มต้น migrations จึงเรียก gen_random_bytes()
-- แบบไม่ระบุ schema ได้ ฐานข้อมูลเปล่าต้องตั้งเองไม่งั้นพังกลางไฟล์แรก
do $sp$
begin
  execute format('alter database %I set search_path = public, extensions', current_database());
end;
$sp$;
set search_path = public, extensions;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- เทสสวมบทผู้ใช้ด้วย `set local request.jwt.claim.sub` เหมือนที่ Supabase ทำ
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text);
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  owner uuid,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- เผื่อ shim เวอร์ชันเก่าสร้างตารางไว้แล้ว create table if not exists จะไม่เติมคอลัมน์ให้
alter table storage.buckets
  add column if not exists owner uuid,
  add column if not exists file_size_limit bigint,
  add column if not exists allowed_mime_types text[],
  add column if not exists updated_at timestamptz not null default now();

create table if not exists storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;
