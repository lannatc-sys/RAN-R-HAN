-- ==============================================================================
-- Rab-R-HAN (รับอาหาร) Pickup MVP: Migration 03
-- File: supabase/migrations/20260906000001_pickup_mvp.sql
-- Description: Schema additions for pickup/takeaway MVP, encrypted credentials,
--              slip logs, web push, and security-definer RPCs for order/payment
-- ==============================================================================

-- 1. เพิ่มค่า enum และคอลัมน์ใน orders สำหรับ Delivery & Takeaway
alter type public.order_type add value if not exists 'delivery';

alter table public.orders
    add column if not exists source text not null default 'customer'
        check (source in ('customer', 'staff')),
    add column if not exists customer_name text,
    add column if not exists delivery_address text,
    add column if not exists delivery_lat numeric(10, 7),
    add column if not exists delivery_lng numeric(10, 7),
    add column if not exists table_no text;

-- 2. เพิ่มคอลัมน์การตั้งค่าอุปกรณ์ ความปลอดภัย และช่องทางให้บริการใน shops
alter table public.shops
    add column if not exists has_printer boolean not null default false,
    add column if not exists device_mode text not null default 'multi_device'
        check (device_mode in ('single_device', 'multi_device')),
    add column if not exists kds_pin text not null default '0000',
    add column if not exists support_access_expires_at timestamptz,
    add column if not exists allow_dine_in boolean not null default true,
    add column if not exists allow_takeaway boolean not null default true,
    add column if not exists allow_delivery boolean not null default false,
    add column if not exists is_delivery_enabled boolean not null default false;

-- 3. เพิ่มคอลัมน์และ Unique Index ใน payments สำหรับตรวจสอบสลิปซ้ำ
alter table public.payments
    add column if not exists trans_ref text;

create unique index if not exists payments_trans_ref_uq
    on public.payments (trans_ref)
    where trans_ref is not null;

-- 4. ตาราง shop_payment_credentials สำหรับเก็บ API URL และ API Key ตรวจสลิปแบบเข้ารหัส
create table if not exists public.shop_payment_credentials (
    shop_id uuid primary key references public.shops(id) on delete cascade,
    slip_check_provider text not null default 'slipok',
    api_url text,
    api_key_encrypted bytea not null,
    updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists trg_shop_payment_credentials_updated_at on public.shop_payment_credentials;
create trigger trg_shop_payment_credentials_updated_at
    before update on public.shop_payment_credentials
    for each row execute function public.handle_updated_at();

alter table public.shop_payment_credentials enable row level security;

-- นโยบาย RLS: ป้องกันการ SELECT ตรงจาก client ทุกกรณี (แม้กระทั่ง owner)
-- อ่าน/เขียนได้เฉพาะฝั่ง server ผ่าน service role key เท่านั้น
-- สำหรับ owner อนุญาตเฉพาะ INSERT / UPDATE (write-only) ผ่าน application
drop policy if exists "Owners can insert or update their shop payment credentials" on public.shop_payment_credentials;
create policy "Owners can insert or update their shop payment credentials"
    on public.shop_payment_credentials
    for all
    using (public.is_shop_owner(shop_id))
    with check (public.is_shop_owner(shop_id));

-- ปิดสิทธิ์ SELECT ของ authenticated role บนคอลัมน์ api_key_encrypted เพื่อความปลอดภัยสองชั้น
revoke select on public.shop_payment_credentials from authenticated, anon;
grant insert, update, delete on public.shop_payment_credentials to authenticated;

-- 5. ตาราง payment_slips สำหรับเก็บ raw payload สำหรับ debug / audit ย้อนหลัง
create table if not exists public.payment_slips (
    id uuid primary key default gen_random_uuid(),
    payment_id uuid not null references public.payments(id) on delete cascade,
    raw_payload jsonb not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.payment_slips enable row level security;

drop policy if exists "Shop members can view payment slips" on public.payment_slips;
create policy "Shop members can view payment slips"
    on public.payment_slips
    for select
    using (
        exists (
            select 1
            from public.payments p
            join public.orders o on o.id = p.order_id
            where p.id = payment_slips.payment_id
              and public.has_shop_access(o.shop_id)
        )
    );

-- 6. ตาราง push_subscriptions สำหรับ Web Push Notification
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    shop_id uuid not null references public.shops(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can manage own push subscriptions" on public.push_subscriptions;
create policy "Users can manage own push subscriptions"
    on public.push_subscriptions
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- 7. Sequence หรือ Helper สำหรับสร้าง order_no แบบสั้นสำหรับร้าน (เช่น A001, A002 ในแต่ละวัน)
create or replace function public.generate_order_no(p_shop_id uuid)
returns text as $$
declare
    v_count integer;
    v_today date;
begin
    v_today := (timezone('Asia/Bangkok'::text, now()))::date;
    
    select count(*) + 1 into v_count
    from public.orders
    where shop_id = p_shop_id
      and (timezone('Asia/Bangkok'::text, created_at))::date = v_today;
      
    return 'A' || lpad(v_count::text, 3, '0');
end;
$$ language plpgsql security definer set search_path = public;

-- 8. RPC: create_pickup_order
-- สร้างออเดอร์ Takeaway/Pickup หรือ Delivery อย่างปลอดภัย โดยดึงราคาจาก DB เท่านั้น (ห้ามเชื่อราคาจาก client)
drop function if exists public.create_pickup_order(uuid, jsonb, text, timestamptz, text);
drop function if exists public.create_pickup_order(uuid, jsonb, text, timestamptz, text, text);
drop function if exists public.create_pickup_order(uuid, jsonb, text, timestamptz, text, text, text, text, text, numeric, numeric);
drop function if exists public.create_pickup_order(uuid, jsonb, text, timestamptz, text, text, text, text, text, numeric, numeric, text);

create or replace function public.create_pickup_order(
    p_shop_id uuid,
    p_items jsonb, -- Array of: { "menu_item_id": "uuid", "qty": 1, "option_ids": ["uuid"], "note": "" }
    p_customer_phone text default null,
    p_pickup_at timestamptz default null,
    p_note text default null,
    p_source text default 'customer',
    p_type text default 'takeaway',
    p_customer_name text default null,
    p_delivery_address text default null,
    p_delivery_lat numeric default null,
    p_delivery_lng numeric default null,
    p_table_no text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_shop record;
    v_order_id uuid;
    v_order_no text;
    v_subtotal numeric(10, 2) := 0.00;
    v_service_charge numeric(10, 2) := 0.00;
    v_vat numeric(10, 2) := 0.00;
    v_total numeric(10, 2) := 0.00;
    v_item jsonb;
    v_menu record;
    v_qty integer;
    v_opt_ids uuid[];
    v_opts_json jsonb;
    v_options_delta numeric(10, 2) := 0.00;
    v_item_unit_price numeric(10, 2) := 0.00;
    v_line_total numeric(10, 2) := 0.00;
    v_order_type public.order_type := 'takeaway'::public.order_type;
begin
    -- 1. ตรวจสอบร้านค้า
    select * into v_shop
    from public.shops
    where id = p_shop_id and is_active = true and status = 'active';

    if not found then
        raise exception 'SHOP_NOT_FOUND: ร้านค้านี้ไม่ได้เปิดให้บริการ';
    end if;

    -- 2. ตรวจสอบความถูกต้องของรายการสั่งซื้อ
    if p_items is null or jsonb_array_length(p_items) = 0 then
        raise exception 'EMPTY_CART: ไม่มีรายการอาหารในตะกร้า';
    end if;

    if p_source not in ('customer', 'staff') then
        raise exception 'INVALID_SOURCE: แหล่งที่มาของออเดอร์ไม่ถูกต้อง';
    end if;

    if p_type = 'delivery' then
        v_order_type := 'delivery'::public.order_type;
    elsif p_type = 'dine_in' then
        v_order_type := 'dine_in'::public.order_type;
    else
        v_order_type := 'takeaway'::public.order_type;
    end if;

    -- ตรวจสอบว่าร้านค้าเปิดรับออเดอร์ประเภทนี้หรือไม่
    if v_order_type = 'delivery' and not coalesce(v_shop.allow_delivery, false) then
        raise exception 'CHANNEL_NOT_ALLOWED: ร้านค้านี้ไม่ได้เปิดรับออเดอร์จัดส่ง';
    elsif v_order_type = 'dine_in' and not coalesce(v_shop.allow_dine_in, true) then
        raise exception 'CHANNEL_NOT_ALLOWED: ร้านค้านี้ไม่ได้เปิดรับออเดอร์ทานที่ร้าน';
    elsif v_order_type = 'takeaway' and not coalesce(v_shop.allow_takeaway, true) then
        raise exception 'CHANNEL_NOT_ALLOWED: ร้านค้านี้ไม่ได้เปิดรับออเดอร์สั่งกลับบ้าน';
    end if;

    -- 3. รันเลขที่ออเดอร์
    v_order_no := public.generate_order_no(p_shop_id);

    -- 4. สร้างหัวบิล orders ก่อน (subtotal = 0 แล้วจะคำนวณและอัปเดต)
    insert into public.orders (
        shop_id,
        table_id,
        table_no,
        order_no,
        type,
        status,
        source,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_lat,
        delivery_lng,
        pickup_at,
        note,
        subtotal,
        service_charge_amount,
        vat_amount,
        total
    ) values (
        p_shop_id,
        null,
        nullif(trim(p_table_no), ''),
        v_order_no,
        v_order_type,
        'pending',
        p_source,
        nullif(trim(p_customer_name), ''),
        nullif(trim(p_customer_phone), ''),
        nullif(trim(p_delivery_address), ''),
        p_delivery_lat,
        p_delivery_lng,
        p_pickup_at,
        nullif(trim(p_note), ''),
        0.00,
        0.00,
        0.00,
        0.00
    ) returning id into v_order_id;

    -- 5. วนลูปตรวจสอบราคาและสร้าง order_items แต่ละรายการ
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_qty := coalesce((v_item->>'qty')::integer, 0);
        if v_qty <= 0 or v_qty > 99 then
            raise exception 'INVALID_QTY: จำนวนอาหารไม่ถูกต้อง (1-99)';
        end if;

        -- ดึงข้อมูลเมนูจริงจากฐานข้อมูล พร้อมล็อกแถวป้องกันการแก้ไขราคาระหว่างสั่ง
        select id, name, price, is_available
        into v_menu
        from public.menu_items
        where id = (v_item->>'menu_item_id')::uuid
          and shop_id = p_shop_id
        for share;

        if not found then
            raise exception 'MENU_NOT_FOUND: ไม่พบเมนูที่ระบุในร้านนี้';
        end if;

        if not v_menu.is_available then
            raise exception 'MENU_UNAVAILABLE: เมนู "%" หมดชั่วคราว', v_menu.name;
        end if;

        -- แปลง option_ids เป็น array
        select coalesce(array_agg(x::uuid), '{}')
        into v_opt_ids
        from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) x;

        -- ดึง options จริงจากตาราง options พร้อมคำนวณ price_delta รวม
        if array_length(v_opt_ids, 1) > 0 then
            select
                coalesce(jsonb_agg(
                    jsonb_build_object(
                        'id', o.id,
                        'name', o.name,
                        'price_delta', o.price_delta
                    ) order by o.sort_order
                ), '[]'::jsonb),
                coalesce(sum(o.price_delta), 0.00)
            into v_opts_json, v_options_delta
            from public.options o
            where o.id = any(v_opt_ids)
              and o.menu_item_id = v_menu.id
              and o.is_available = true;
        else
            v_opts_json := '[]'::jsonb;
            v_options_delta := 0.00;
        end if;

        v_item_unit_price := v_menu.price + v_options_delta;
        v_line_total := v_item_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;

        -- บันทึก snapshot ลง order_items (ราคา ณ ขณะสั่งซื้อ)
        insert into public.order_items (
            order_id,
            menu_item_id,
            name_snapshot,
            price_snapshot,
            qty,
            options_json,
            note,
            status
        ) values (
            v_order_id,
            v_menu.id,
            v_menu.name,
            v_item_unit_price,
            v_qty,
            v_opts_json,
            nullif(trim(v_item->>'note'), ''),
            'pending'
        );
    end loop;

    -- 6. คำนวณภาษีและค่าบริการตามการตั้งค่าของร้านค้า
    if v_shop.service_charge > 0 then
        v_service_charge := round(v_subtotal * (v_shop.service_charge / 100.0), 2);
    end if;

    if v_shop.vat_mode = 'exclusive' then
        v_vat := round((v_subtotal + v_service_charge) * 0.07, 2);
        v_total := v_subtotal + v_service_charge + v_vat;
    elsif v_shop.vat_mode = 'inclusive' then
        v_vat := round((v_subtotal + v_service_charge) * 7.0 / 107.0, 2);
        v_total := v_subtotal + v_service_charge;
    else
        v_vat := 0.00;
        v_total := v_subtotal + v_service_charge;
    end if;

    -- 7. อัปเดตยอดคำนวณสุทธิลงใน orders
    update public.orders
    set subtotal = v_subtotal,
        service_charge_amount = v_service_charge,
        vat_amount = v_vat,
        total = v_total
    where id = v_order_id;

    return jsonb_build_object(
        'order_id', v_order_id,
        'order_no', v_order_no,
        'subtotal', v_subtotal,
        'service_charge', v_service_charge,
        'vat', v_vat,
        'total', v_total
    );
end;
$$;

revoke execute on function public.create_pickup_order from public;
grant execute on function public.create_pickup_order to anon, authenticated;

-- 9. RPC: verify_and_confirm_payment
-- ยืนยันการชำระเงินและเปลี่ยนสถานะออเดอร์เป็น 'confirmed' แบบ atomic
create or replace function public.verify_and_confirm_payment(
    p_order_id uuid,
    p_amount numeric(10, 2),
    p_trans_ref text,
    p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_order record;
    v_payment_id uuid;
begin
    -- 1. ล็อกออเดอร์เพื่อตรวจสอบสถานะ
    select * into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        raise exception 'ORDER_NOT_FOUND: ไม่พบคำสั่งซื้อที่ระบุ';
    end if;

    if v_order.status in ('completed', 'cancelled') then
        raise exception 'ORDER_FINALIZED: ออเดอร์นี้เสร็จสิ้นหรือถูกยกเลิกไปแล้ว';
    end if;

    -- 2. ตรวจสอบยอดเงิน (ยอดสลิปต้องไม่น้อยกว่ายอดบิล)
    if p_amount < v_order.total then
        raise exception 'UNDERPAID: ยอดเงินในสลิป ( % บาท) ไม่ครบตามยอดบิล ( % บาท)', p_amount, v_order.total;
    end if;

    -- 3. ตรวจสอบหรือสร้างรายการ payments
    -- หากมี payment ที่ pending อยู่แล้ว ให้อัปเดต ถ้ายังไม่มีให้สร้างใหม่
    select id into v_payment_id
    from public.payments
    where order_id = p_order_id and status = 'pending'
    limit 1;

    if v_payment_id is not null then
        update public.payments
        set method = 'promptpay',
            amount = p_amount,
            trans_ref = p_trans_ref,
            status = 'verified',
            verified_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        where id = v_payment_id;
    else
        insert into public.payments (
            order_id,
            method,
            amount,
            trans_ref,
            status,
            verified_at
        ) values (
            p_order_id,
            'promptpay',
            p_amount,
            p_trans_ref,
            'verified',
            timezone('utc'::text, now())
        ) returning id into v_payment_id;
    end if;

    -- 4. บันทึก raw payload ลง payment_slips สำหรับ audit
    insert into public.payment_slips (
        payment_id,
        raw_payload
    ) values (
        v_payment_id,
        p_raw_payload
    );

    -- 5. ปรับสถานะออเดอร์เป็น 'confirmed'
    update public.orders
    set status = 'confirmed',
        updated_at = timezone('utc'::text, now())
    where id = p_order_id;

    return jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payment_id', v_payment_id,
        'order_no', v_order.order_no,
        'status', 'confirmed'
    );
end;
$$;

revoke execute on function public.verify_and_confirm_payment from public;
grant execute on function public.verify_and_confirm_payment to service_role;
