'use server';

import { createOrderSchema, CreateOrderInput } from '@/lib/validations/order';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatThaiError } from '@/lib/thai-errors';
import { sendPushToShop } from '@/lib/push';
import { sendOrderStatusMessage } from '@/lib/telegram';
import { shouldAutoDispatch } from '@/lib/dispatch-trigger';

export async function createPickupOrderAction(rawInput: CreateOrderInput) {
  try {
    // 1. ตรวจสอบข้อมูลด้วย Zod
    const validated = createOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      const firstError = validated.error.errors[0]?.message || 'ข้อมูลการสั่งซื้อไม่ถูกต้อง';
      return { success: false, error: firstError };
    }

    const {
      shop_id,
      type,
      table_no,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_lat,
      delivery_lng,
      pickup_at,
      note,
      source,
      items,
      payment_method,
    } = validated.data;

    const supabase = await createClient();

    // 2. เรียก RPC create_pickup_order
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_pickup_order', {
      p_shop_id: shop_id,
      p_items: items,
      p_customer_phone: customer_phone || null,
      p_pickup_at: pickup_at ? new Date(pickup_at).toISOString() : null,
      p_note: note || null,
      p_source: source,
      p_type: type,
      p_customer_name: customer_name || null,
      p_delivery_address: delivery_address || null,
      p_delivery_lat: delivery_lat ?? null,
      p_delivery_lng: delivery_lng ?? null,
      p_table_no: table_no || null,
    });

    if (rpcError) {
      return { success: false, error: formatThaiError(rpcError) };
    }

    const orderId = rpcResult.order_id;
    const orderNo = rpcResult.order_no;
    const total = rpcResult.total;

    // 3. สร้าง Payment record (pending)
    const admin = createAdminClient();
    const { error: paymentError } = await admin.from('payments').insert({
      order_id: orderId,
      method: payment_method,
      amount: total,
      status: 'pending',
    });

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError);
    }

    // 4. ส่ง Web Push Notification ไปยังหน้าร้าน/ครัว
    const isDelivery = type === 'delivery';
    const isDineIn = type === 'dine_in';
    const paymentLabel = payment_method === 'cash' ? 'เงินสด' : 'พร้อมเพย์';

    let pushTitle = `ออเดอร์ใหม่ #${orderNo}`;
    if (isDelivery) {
      pushTitle = `🛵 ออเดอร์จัดส่งใหม่ #${orderNo}`;
    } else if (isDineIn) {
      pushTitle = `🍽️ ออเดอร์ทานที่ร้าน โต๊ะ ${table_no || '-'} #${orderNo}`;
    }

    let pushBody = `ยอด ${Number(total).toLocaleString('th-TH')} บาท (${paymentLabel}) กำลังรอการยืนยัน`;
    if (isDelivery) {
      pushBody = `ยอด ${Number(total).toLocaleString('th-TH')} บาท (${paymentLabel}) • ส่งให้ ${customer_name || 'ลูกค้า'}`;
    } else if (isDineIn) {
      pushBody = `โต๊ะ ${table_no || '-'} • ยอด ${Number(total).toLocaleString('th-TH')} บาท (${paymentLabel})`;
    }

    await sendPushToShop(shop_id, {
      title: pushTitle,
      body: pushBody,
      orderId,
      orderNo,
    });

    return {
      success: true,
      data: {
        order_id: orderId,
        order_no: orderNo,
        total: Number(total),
        subtotal: Number(rpcResult.subtotal),
        service_charge: Number(rpcResult.service_charge),
        vat: Number(rpcResult.vat),
      },
    };
  } catch (error: any) {
    console.error('createPickupOrderAction error:', error);
    return { success: false, error: formatThaiError(error) };
  }
}

/**
 * Server Action สำหรับอัปเดตสถานะออเดอร์ (Staff / Owner)
 */
export async function updateOrderStatusAction(
  orderId: string,
  newStatus: 'confirmed' | 'cooking' | 'served' | 'completed' | 'cancelled'
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    // อ่านสภาพออเดอร์ก่อนเปลี่ยนสถานะ ใช้ตัดสินว่าต้องจุด dispatch ต่อหรือไม่
    // อ่านก่อนเพื่อให้เห็น dispatch_status ณ ตอนที่ครัวกด กันการกดซ้ำสั่งจ่ายงานซ้อน
    const { data: beforeUpdate } = await supabase
      .from('orders')
      .select('type, dispatch_status, delivery_lat, delivery_lng')
      .eq('id', orderId)
      .maybeSingle();

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      return { success: false, error: formatThaiError(error) };
    }

    // แจ้งเตือนสถานะออเดอร์ไปยัง Telegram ของลูกค้า (แบบ Background Asynchronous)
    triggerTelegramOrderStatusNotification(orderId, newStatus).catch((err) =>
      console.error('[Telegram] Order status trigger error:', err)
    );

    // ครัวกดว่าอาหารเสร็จแล้วให้จ่ายงานต่อทันที ไม่ต้องรอคนกดปุ่มในหน้าแอดมิน
    //
    // ตั้งใจไม่ await และไม่ให้ผลลัพธ์ของ dispatch มีผลต่อค่าที่คืนกลับ
    // การจ่ายงานล้มเหลว เช่นยังไม่มีไรเดอร์ออนไลน์ ไม่ควรทำให้ครัวกด
    // "อาหารเสร็จ" ไม่สำเร็จ หรือย้อนสถานะที่ครัวตั้งใจเปลี่ยนไปแล้ว
    // ตรรกะการจ่ายงานทั้งหมดยังอยู่ที่ dispatchOrderAction ที่เดียว ไม่เขียนซ้ำ
    if (shouldAutoDispatch(newStatus, beforeUpdate)) {
      void import('@/app/actions/dispatch')
        .then(({ dispatchOrderAction }) => dispatchOrderAction(orderId))
        .then((res) => {
          if (!res?.success) {
            console.warn('[auto-dispatch] จ่ายงานอัตโนมัติไม่สำเร็จ:', orderId, res?.error);
          }
        })
        .catch((err) => console.error('[auto-dispatch] error:', orderId, err));
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: formatThaiError(error) };
  }
}

/**
 * ฟังก์ชันช่วยส่งการแจ้งเตือน Telegram ตามสถานะออเดอร์
 */
async function triggerTelegramOrderStatusNotification(orderId: string, status: string) {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select(`
        order_no,
        telegram_chat_id,
        shops (
          name,
          telegram_enabled
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (order && order.telegram_chat_id) {
      const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
      if (!shop || (shop as any).telegram_enabled !== false) {
        const shopName = (shop as any)?.name || 'RAN-R-HAN';
        await sendOrderStatusMessage(
          order.telegram_chat_id,
          status,
          order.order_no,
          shopName
        );
      }
    }
  } catch (tgErr) {
    console.error('[Telegram Notification Warning]:', tgErr);
  }
}

/**
 * Server Action สำหรับพนักงานกดยืนยันรับเงินสด (Staff / Owner)
 */
export async function confirmCashPaymentAction(orderId: string) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const admin = createAdminClient();

    // 1. ค้นหา shop_id ของคำสั่งซื้อเพื่อผูกสิทธิ์
    const { data: order, error: orderLookupError } = await admin
      .from('orders')
      .select('id, shop_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderLookupError || !order) {
      return { success: false, error: 'ไม่พบข้อมูลคำสั่งซื้อ' };
    }

    // 2. ตรวจสอบสิทธิ์ร้านค้า
    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: order.shop_id,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์ยืนยันการชำระเงินของร้านนี้' };
    }

    // 3. อัปเดต payment เป็น verified
    const { error: payError } = await admin
      .from('payments')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .eq('method', 'cash');

    if (payError) {
      return { success: false, error: formatThaiError(payError) };
    }

    // 4. ปรับ order status เป็น confirmed ถ้ายัง pending อยู่
    const { data: updatedOrder } = await admin
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (updatedOrder) {
      triggerTelegramOrderStatusNotification(orderId, 'confirmed').catch((err) =>
        console.error('[Telegram] Cash confirm trigger error:', err)
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: formatThaiError(error) };
  }
}

/**
 * สถานะล่าสุดของออเดอร์สำหรับหน้าติดตามของลูกค้า
 *
 * เดิมหน้า /order/[orderId] รับอัปเดตผ่าน realtime subscription ด้วย anon key
 * ซึ่งบังคับให้ RLS ของ orders/payments ต้องเปิดให้ anon อ่านได้ กลายเป็นว่า
 * ใครก็ดึงออเดอร์ทุกร้านได้ ปิดรูนั้นด้วย 20260914000006 แล้วให้หน้าติดตาม
 * มาถามสถานะทางนี้แทน
 *
 * สิทธิ์ที่ใช้คือ "รู้ order id" เหมือนเดิมทุกประการ — ตัวหน้าเว็บเองก็เปิดด้วย
 * uuid นี้อยู่แล้ว แต่คืนเฉพาะฟิลด์ที่เปลี่ยนตามเวลา ไม่คืนทั้งแถว
 * ชื่อ เบอร์โทร ที่อยู่ลูกค้าไม่ผ่านทางนี้
 */
export async function getOrderTrackingSnapshotAction(orderId: string): Promise<{
  success: boolean;
  status?: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  error?: string;
}> {
  try {
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return { success: false, error: 'ไม่พบคำสั่งซื้อนี้' };
    }

    const admin = createAdminClient();

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      return { success: false, error: formatThaiError(orderError) };
    }
    if (!order) {
      return { success: false, error: 'ไม่พบคำสั่งซื้อนี้' };
    }

    const { data: payment } = await admin
      .from('payments')
      .select('status, method')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      status: order.status,
      paymentStatus: payment?.status ?? null,
      paymentMethod: payment?.method ?? null,
    };
  } catch (err: unknown) {
    console.error('getOrderTrackingSnapshotAction error:', err);
    return { success: false, error: 'ตรวจสอบสถานะไม่สำเร็จ' };
  }
}
