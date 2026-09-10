'use server';

import { createOrderSchema, CreateOrderInput } from '@/lib/validations/order';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatThaiError } from '@/lib/thai-errors';
import { sendPushToShop } from '@/lib/push';
import { sendOrderStatusMessage } from '@/lib/telegram';

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

    // 1. อัปเดต payment เป็น verified
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

    // 2. ปรับ order status เป็น confirmed ถ้ายัง pending อยู่
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
