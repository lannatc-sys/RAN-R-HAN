-- ==============================================================================
-- RAN-R-HAN: คำขอเปลี่ยนหมายเลขพร้อมเพย์ ต้องผ่านการอนุมัติของผู้ดูแลแพลตฟอร์ม
--
-- พร้อมเพย์คือปลายทางที่เงินลูกค้าวิ่งไป ปล่อยให้ร้านแก้เองเมื่อไหร่ก็ได้
-- แปลว่าบัญชีรับเงินเปลี่ยนได้โดยไม่มีใครรู้ ร้านยังเป็นเจ้าของข้อมูลนี้
-- แต่การเปลี่ยนต้องมีร่องรอยและมีคนอนุมัติ
--
-- หมายเลขอาจเป็นเลขบัตรประชาชน ซึ่งเป็นข้อมูลส่วนบุคคลตาม PDPA
-- ตารางนี้จึงเปิดให้เห็นเฉพาะคนของร้านนั้นกับ superadmin เท่านั้น
-- ==============================================================================

create table if not exists public.promptpay_change_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  -- เก็บค่าเดิมไว้ในคำขอ เพื่อให้ยังตอบได้ว่าเปลี่ยนจากอะไรเป็นอะไร
  -- แม้ภายหลังค่าใน shops จะถูกเปลี่ยนไปอีก
  current_promptpay_id text,
  current_promptpay_name text,
  requested_promptpay_id text not null,
  requested_promptpay_name text not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text
);

create index if not exists idx_ppcr_shop on public.promptpay_change_requests (shop_id);
create index if not exists idx_ppcr_status on public.promptpay_change_requests (status, requested_at desc);

-- ร้านหนึ่งค้างได้ครั้งละคำขอเดียว กันการยิงซ้ำจนคิวรก
create unique index if not exists idx_ppcr_one_pending_per_shop
  on public.promptpay_change_requests (shop_id)
  where status = 'pending';

alter table public.promptpay_change_requests enable row level security;

drop policy if exists ppcr_select on public.promptpay_change_requests;
create policy ppcr_select on public.promptpay_change_requests
  for select using (public.has_shop_access(shop_id));

-- เขียนได้เฉพาะผ่าน RPC ที่เป็น security definer ข้างล่าง
drop policy if exists ppcr_no_direct_write on public.promptpay_change_requests;

-- ------------------------------------------------------------------------------
-- ฝั่งร้าน: ยื่นคำขอ
-- ------------------------------------------------------------------------------
create or replace function public.request_promptpay_change(
  p_shop_id uuid,
  p_promptpay_id text,
  p_promptpay_name text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_shop public.shops%rowtype;
  v_digits text;
  v_id uuid;
begin
  if auth.uid() is null or not public.has_shop_access(p_shop_id) then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  v_digits := regexp_replace(coalesce(p_promptpay_id, ''), '[^0-9]', '', 'g');

  -- พร้อมเพย์รับได้สองรูปแบบ เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก
  if length(v_digits) not in (10, 13) then
    raise exception 'INVALID_PROMPTPAY_FORMAT';
  end if;

  if coalesce(trim(p_promptpay_name), '') = '' then
    raise exception 'PROMPTPAY_NAME_REQUIRED';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  if v_shop.promptpay_id is not distinct from v_digits
     and v_shop.promptpay_name is not distinct from trim(p_promptpay_name) then
    raise exception 'PROMPTPAY_UNCHANGED';
  end if;

  if exists (
    select 1 from public.promptpay_change_requests
     where shop_id = p_shop_id and status = 'pending'
  ) then
    raise exception 'PROMPTPAY_REQUEST_ALREADY_PENDING';
  end if;

  insert into public.promptpay_change_requests (
    shop_id, current_promptpay_id, current_promptpay_name,
    requested_promptpay_id, requested_promptpay_name, reason, requested_by
  ) values (
    p_shop_id, v_shop.promptpay_id, v_shop.promptpay_name,
    v_digits, trim(p_promptpay_name), nullif(trim(coalesce(p_reason, '')), ''), auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('request_id', v_id, 'status', 'pending');
end;
$$;

revoke all on function public.request_promptpay_change(uuid, text, text, text) from public, anon;
grant execute on function public.request_promptpay_change(uuid, text, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- ฝั่งผู้ดูแลแพลตฟอร์ม: อนุมัติหรือปฏิเสธ
-- อนุมัติแล้วจึงเขียนลง shops ที่นี่จุดเดียว
-- ------------------------------------------------------------------------------
create or replace function public.review_promptpay_change(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_req public.promptpay_change_requests%rowtype;
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'SHOP_ACCESS_DENIED';
  end if;

  select * into v_req
    from public.promptpay_change_requests
   where id = p_request_id
     for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_REVIEWED';
  end if;

  update public.promptpay_change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_request_id;

  if p_approve then
    update public.shops
       set promptpay_id = v_req.requested_promptpay_id,
           promptpay_name = v_req.requested_promptpay_name,
           updated_at = now()
     where id = v_req.shop_id;

    insert into public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
    values (
      v_req.shop_id,
      auth.uid(),
      'promptpay_changed',
      'shop',
      v_req.shop_id::text,
      jsonb_build_object(
        'request_id', p_request_id,
        'from_id', v_req.current_promptpay_id,
        'to_id', v_req.requested_promptpay_id,
        'from_name', v_req.current_promptpay_name,
        'to_name', v_req.requested_promptpay_name
      )
    );
  end if;

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', case when p_approve then 'approved' else 'rejected' end
  );
end;
$$;

revoke all on function public.review_promptpay_change(uuid, boolean, text) from public, anon;
grant execute on function public.review_promptpay_change(uuid, boolean, text) to authenticated;
