-- ------------------------------------------------------------------------------
-- ปิดการรั่วของข้อมูลลูกค้าทุกร้านผ่าน anon key (PDPA)
--
-- policy เดิมของ orders, order_items และ payments เขียนว่า
--   using ( public.has_shop_access(shop_id) or true )
-- `or true` ทำให้เงื่อนไขข้างหน้าไม่มีผลเลย ใครก็ตามที่มี anon key
-- (ซึ่งฝังอยู่ในหน้าเว็บ เปิด devtools ก็เห็น) select ได้ทุกแถวทุกร้าน
-- รวมชื่อ เบอร์โทร และที่อยู่จัดส่งของลูกค้า
--
-- คอมเมนต์เดิมบอกว่าเปิดไว้ให้ "ลูกค้าเข้าถึง order ตนเองผ่าน Client-side Order ID"
-- ซึ่งทำได้จริงแค่ทางเดียวคือ realtime subscription ของหน้า /order/[orderId]
-- หน้านั้นถูกเปลี่ยนไปดึงสถานะผ่าน server action ที่คืนเฉพาะฟิลด์สถานะแล้ว
-- (getOrderTrackingSnapshotAction) การอ่านฝั่ง server ใช้ service role
-- ซึ่งไม่ผ่าน RLS อยู่แล้ว จึงไม่กระทบ
--
-- **เปลี่ยนสิทธิ์การอ่านบน production** ตรวจก่อน apply ว่า
-- หน้า /order/[orderId] บนเครื่องที่จะ deploy ไม่ได้ subscribe realtime แล้ว
-- ไม่งั้นลูกค้าจะไม่เห็นสถานะอัปเดตสด
-- ------------------------------------------------------------------------------

-- orders ------------------------------------------------------------------
drop policy if exists "Orders viewable by customer and staff" on public.orders;

create policy "Orders viewable by shop staff"
    on public.orders for select
    using ( public.has_shop_access(shop_id) );

-- order_items -------------------------------------------------------------
drop policy if exists "Order items viewable by order owner and staff" on public.order_items;

create policy "Order items viewable by shop staff"
    on public.order_items for select
    using (
        exists (
            select 1 from public.orders
            where orders.id = order_items.order_id
              and public.has_shop_access(orders.shop_id)
        )
    );

-- payments ----------------------------------------------------------------
drop policy if exists "Payments viewable by customer and staff" on public.payments;

create policy "Payments viewable by shop staff"
    on public.payments for select
    using (
        exists (
            select 1 from public.orders
            where orders.id = payments.order_id
              and public.has_shop_access(orders.shop_id)
        )
    );
