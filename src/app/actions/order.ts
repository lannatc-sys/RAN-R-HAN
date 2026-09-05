'use server';

import { createOrderSchema, CreateOrderInput } from '@/lib/validations/order';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatThaiError } from '@/lib/thai-errors';
import { sendPushToShop } from '@/lib/push';

export async function createPickupOrderAction(rawInput: CreateOrderInput) {
  try {
    // 1. ตรวจสอบข้อมูลด้วย Zod
    const validated = createOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      const firstError = validated.error.errors[0]?.message || 'ข้อมูลการสั่งซื้อไม่ถูกต้อง';
      return { success: false, error: firstError };
    }

    const { shop_id, customer_phone, pickup_at, note, source, items, payment_method } = validated.data;

    const supabase = await createClient();

    // 2. เรียก RPC create_pickup_order
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_pickup_order', {
      p_shop_id: shop_id,
      p_items: items,
      p_customer_phone: customer_phone || null,
      p_pickup_at: pickup_at ? new Date(pickup_at).toISOString() : null,
      p_note: note || null,
      p_source: source,
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

    // 4. ส่ง Web Push แจ้งเตือนร้านค้า
    const paymentLabel = payment_method === 'cash' ? 'เงินสดหน้าร้าน' : 'พร้อมเพย์';
    await sendPushToShop(shop_id, {
      title: `ออเดอร์ใหม่ #${orderNo}`,
      body: `ยอด ${Number(total).toLocaleString('th-TH')} บาท (${paymentLabel}) กำลังรอการยืนยัน`,
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

    return { success: true };
  } catch (error: any) {
    return { success: false, error: formatThaiError(error) };
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
    await admin
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: formatThaiError(error) };
  }
}
