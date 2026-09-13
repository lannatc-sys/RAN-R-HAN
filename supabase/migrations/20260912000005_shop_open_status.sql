-- ==============================================================================
-- RAN-R-HAN: Shop operational open/closed status
-- Keeps daily trading state separate from account lifecycle (status/is_active).
-- ==============================================================================

alter table public.shops
    add column if not exists is_open boolean not null default true;

comment on column public.shops.is_open is
    'สถานะเปิดรับออเดอร์ของร้าน: true = เปิด, false = ปิด';

-- Narrow mutation boundary for web now and LINE/Telegram adapters later.
-- Staff, owner, and superadmin are authorized by has_shop_access().
create or replace function public.set_shop_open_status(
    p_shop_id uuid,
    p_is_open boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_slug text;
begin
    if p_is_open is null then
        raise exception 'INVALID_SHOP_OPEN_STATUS: สถานะร้านไม่ถูกต้อง';
    end if;

    if not public.has_shop_access(p_shop_id) then
        raise exception 'FORBIDDEN: ไม่มีสิทธิ์เปลี่ยนสถานะร้านนี้';
    end if;

    update public.shops
    set is_open = p_is_open
    where id = p_shop_id
    returning slug into v_slug;

    if not found then
        raise exception 'SHOP_NOT_FOUND: ไม่พบร้านค้าที่ระบุ';
    end if;

    return jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'slug', v_slug,
        'is_open', p_is_open
    );
end;
$$;

revoke all on function public.set_shop_open_status(uuid, boolean) from public;
grant execute on function public.set_shop_open_status(uuid, boolean) to authenticated;

comment on function public.set_shop_open_status(uuid, boolean) is
    'เปลี่ยนสถานะเปิดรับออเดอร์ โดยอนุญาตเฉพาะสมาชิกของร้านและ superadmin';

-- Enforce the closed state at the database boundary so a stale checkout page
-- or a direct RPC call cannot create an order after the shop is closed.
create or replace function public.enforce_shop_open_for_new_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_open boolean;
begin
    select s.is_open
    into v_is_open
    from public.shops s
    where s.id = new.shop_id
    for share;

    if not found or not coalesce(v_is_open, false) then
        raise exception 'SHOP_CLOSED: ร้านปิดรับออเดอร์ชั่วคราว';
    end if;

    return new;
end;
$$;

revoke all on function public.enforce_shop_open_for_new_orders() from public;

drop trigger if exists trg_enforce_shop_open_for_new_orders on public.orders;
create trigger trg_enforce_shop_open_for_new_orders
    before insert on public.orders
    for each row execute function public.enforce_shop_open_for_new_orders();
