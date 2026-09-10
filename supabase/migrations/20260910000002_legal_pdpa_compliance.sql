-- ==============================================================================
-- RAN-R-HAN Migration: Legal & PDPA Compliance (WP-19 to WP-23)
-- File: supabase/migrations/20260910000002_legal_pdpa_compliance.sql
-- ==============================================================================

-- 1. ตารางบันทึกความยินยอมของลูกค้า (Consent Logs - WP-20)
create table if not exists public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_phone text,
  consent_type text not null check (consent_type in ('terms_and_privacy', 'gps_location', 'marketing')),
  policy_version text not null default '2026-09-10',
  ip_address text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

-- 2. ตารางบันทึกการกระทำสำคัญและความปลอดภัย (Audit Logs - WP-21)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete set null,
  user_id uuid, -- รหัส staff หรือ system
  action text not null, -- เช่น 'import_preorder_comments', 'delete_order', 'export_data'
  entity_type text not null, -- เช่น 'preorder_items', 'orders', 'delivery_trips'
  entity_id text,
  details jsonb, -- เก็บข้อมูลสรุป เช่น { count: 5, round_id: '...' }
  ip_address text,
  created_at timestamptz not null default now()
);

-- 3. ตารางคำขอใช้สิทธิของเจ้าของข้อมูลตาม PDPA (Data Subject Requests - WP-23)
create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete set null,
  requester_name text not null,
  requester_phone text not null,
  requester_email text,
  request_type text not null check (
    request_type in (
      'access',          -- ขอเข้าถึง
      'copy',            -- ขอรับสำเนา
      'correct',         -- ขอแก้ไข
      'delete',          -- ขอลบ/ทำลาย
      'suspend',         -- ขอระงับใช้
      'portability',     -- ขอโอนย้าย
      'withdraw',        -- ขอถอนความยินยอม
      'object'           -- ขอคัดค้าน
    )
  ),
  details text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  admin_notes text,
  due_date timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
create index if not exists idx_consent_logs_shop on public.consent_logs(shop_id);
create index if not exists idx_consent_logs_order on public.consent_logs(order_id);
create index if not exists idx_audit_logs_shop on public.audit_logs(shop_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at);
create index if not exists idx_dsr_shop on public.data_subject_requests(shop_id);
create index if not exists idx_dsr_status on public.data_subject_requests(status);

-- ==============================================================================
-- RLS POLICIES (Row-Level Security)
-- ==============================================================================
alter table public.consent_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.data_subject_requests enable row level security;

-- consent_logs: ลูกค้าสามารถบันทึกได้ผ่าน server action, staff อ่านได้เฉพาะร้านตัวเอง
drop policy if exists "Anyone can insert consent logs" on public.consent_logs;
create policy "Anyone can insert consent logs"
  on public.consent_logs for insert
  with check (true);

drop policy if exists "Staff can view shop consent logs" on public.consent_logs;
create policy "Staff can view shop consent logs"
  on public.consent_logs for select
  using (shop_id is null or has_shop_access(shop_id));

-- audit_logs: เฉพาะ staff และ service_role
drop policy if exists "Staff can view shop audit logs" on public.audit_logs;
create policy "Staff can view shop audit logs"
  on public.audit_logs for select
  using (shop_id is null or has_shop_access(shop_id));

drop policy if exists "Staff can insert audit logs" on public.audit_logs;
create policy "Staff can insert audit logs"
  on public.audit_logs for insert
  with check (shop_id is null or has_shop_access(shop_id));

-- data_subject_requests: บุคคลทั่วไปส่งคำขอได้ (insert), staff/admin จัดการได้
drop policy if exists "Public can submit data subject requests" on public.data_subject_requests;
create policy "Public can submit data subject requests"
  on public.data_subject_requests for insert
  with check (true);

drop policy if exists "Staff can view and update data subject requests" on public.data_subject_requests;
create policy "Staff can view and update data subject requests"
  on public.data_subject_requests for all
  using (shop_id is null or has_shop_access(shop_id))
  with check (shop_id is null or has_shop_access(shop_id));
