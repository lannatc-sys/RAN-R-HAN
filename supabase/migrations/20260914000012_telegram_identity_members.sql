-- ==============================================================================
-- RAN-R-HAN: multi-shop membership + verified Telegram identity (operational gateway)
--
-- ปัญหาเดิม:
--  1. public.users ผูก user ไว้กับร้านเดียว (shop_id) has_shop_access จึงตอบ
--     ได้แค่ร้านเดียว — user ที่ดูแลหลายร้าน (Shop A + Shop B) เป็นไปไม่ได้
--  2. Telegram ผูกแค่ chat_id ดิบ (orders.telegram_chat_id, riders.telegram_chat_id)
--     ซึ่งกรอกมือได้ ไม่มีการยืนยันว่าเป็นของ user คนไหน
--
-- รอบนี้เติมแบบ additive เท่านั้น:
--  - public.shop_members: สมาชิกหลายร้านต่อ user (role/is_active ต่อแถว)
--  - backfill จาก users.shop_id ที่มีอยู่ แล้วคงคอลัมน์เดิมไว้ไม่ลบ
--  - has_shop_access / is_shop_owner: เพิ่มเงื่อนไข membership แบบ OR
--    (ของเดิมยังทำงานเหมือนเดิมทุกประการ)
--  - public.telegram_identities: ผูก telegram_user_id <-> user_id ที่ verified
--  - public.telegram_verify_tokens: token อายุสั้นใช้ครั้งเดียวสำหรับผูกบัญชี
--
-- Dependency: public.users, public.shops, auth.users (ทั้งหมดมาก่อนตั้งแต่
-- 20260904000001) และ public.handle_updated_at() (มีตั้งแต่ initial schema)
-- ไม่แตะสูตรเงิน ไม่แตะ Service Area / Rider Monitor / dispatch logic
-- ==============================================================================

begin;

-- 1. Multi-shop membership -------------------------------------------------------
create table if not exists public.shop_members (
  user_id uuid not null references public.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, shop_id)
);

-- Backfill: สมาชิกเดิมจาก users.shop_id (รันซ้ำได้ ไม่สร้างแถวซ้ำ)
insert into public.shop_members (user_id, shop_id, role)
select id, shop_id, role
  from public.users
 where shop_id is not null
on conflict (user_id, shop_id) do nothing;

create index if not exists idx_shop_members_shop_id on public.shop_members(shop_id);
create index if not exists idx_shop_members_user_active on public.shop_members(user_id)
 where is_active;

do $trigger$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_shop_members_updated_at'
  ) then
    create trigger trg_shop_members_updated_at
      before update on public.shop_members
      for each row execute function public.handle_updated_at();
  end if;
end;
$trigger$;

alter table public.shop_members enable row level security;

drop policy if exists "Superadmin manages shop memberships" on public.shop_members;
create policy "Superadmin manages shop memberships"
  on public.shop_members for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Members can view own memberships" on public.shop_members;
create policy "Members can view own memberships"
  on public.shop_members for select
  using (user_id = auth.uid());

-- Service role bypasses RLS by default (คงพฤติกรรมเดียวกับตารางอื่น).

-- 2. Widen access checks (additive OR — เงื่อนไขเดิมยังอยู่ครบ) -------------------
create or replace function public.has_shop_access(lookup_shop_id uuid)
returns boolean as $$
    select exists (
        select 1
        from public.users
        where id = auth.uid()
          and (role = 'superadmin' or shop_id = lookup_shop_id)
    ) or exists (
        select 1
        from public.shop_members
        where user_id = auth.uid()
          and shop_id = lookup_shop_id
          and is_active
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_shop_owner(lookup_shop_id uuid)
returns boolean as $$
    select exists (
        select 1
        from public.users
        where id = auth.uid()
          and (role = 'superadmin' or (shop_id = lookup_shop_id and role = 'owner'))
    ) or exists (
        select 1
        from public.shop_members
        where user_id = auth.uid()
          and shop_id = lookup_shop_id
          and role = 'owner'
          and is_active
    );
$$ language sql stable security definer set search_path = public;

-- 3. Verified Telegram identity ---------------------------------------------------
-- หนึ่ง Telegram account ผูกกับหนึ่ง user; หนึ่ง user มีได้หนึ่งลิงก์ active
-- (telegram_user_id เป็นระดับ account ไม่ใช่ระดับอุปกรณ์)
create table if not exists public.telegram_identities (
  telegram_user_id bigint primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_chat_id bigint,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists uq_telegram_identities_active_user
  on public.telegram_identities(user_id)
  where revoked_at is null;

create index if not exists idx_telegram_identities_user_id
  on public.telegram_identities(user_id);

do $trigger$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_telegram_identities_updated_at'
  ) then
    create trigger trg_telegram_identities_updated_at
      before update on public.telegram_identities
      for each row execute function public.handle_updated_at();
  end if;
end;
$trigger$;

alter table public.telegram_identities enable row level security;

drop policy if exists "Users can view own telegram link" on public.telegram_identities;
create policy "Users can view own telegram link"
  on public.telegram_identities for select
  using (user_id = auth.uid());

-- 4. One-time verify tokens (อายุสั้น ใช้ครั้งเดียว) ------------------------------
create table if not exists public.telegram_verify_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_user_id bigint,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_verify_tokens_user_id
  on public.telegram_verify_tokens(user_id);
create index if not exists idx_telegram_verify_tokens_active
  on public.telegram_verify_tokens(token)
  where used = false;

alter table public.telegram_verify_tokens enable row level security;

drop policy if exists "Users can view own verify tokens" on public.telegram_verify_tokens;
create policy "Users can view own verify tokens"
  on public.telegram_verify_tokens for select
  using (user_id = auth.uid());

-- Service role bypasses RLS by default (webhook ใช้ service role ผ่าน admin client).

comment on table public.shop_members is
  'Multi-shop membership: หนึ่ง user อยู่ได้หลายร้าน แถวละ role/is_active; backfill จาก users.shop_id';
comment on table public.telegram_identities is
  'Verified Telegram identity: telegram_user_id ผูกกับ user_id ที่ยืนยันแล้วเท่านั้น';
comment on table public.telegram_verify_tokens is
  'One-time verify tokens อายุ 10 นาที ใช้ผูก Telegram account กับ user ที่ login แล้ว';

commit;
