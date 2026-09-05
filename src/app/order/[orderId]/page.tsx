import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { OrderTrackerClient } from './OrderTrackerClient';
import { generatePromptPayQR } from '@/lib/promptpay';
import { Order, Shop, Payment } from '@/lib/types';

interface OrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { orderId } = await params;
  const admin = createAdminClient();

  // 1. ดึงข้อมูลออเดอร์พร้อมรายการอาหาร
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    notFound();
  }

  // 2. ดึงข้อมูลร้านค้า
  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('*')
    .eq('id', order.shop_id)
    .single();

  if (shopError || !shop) {
    notFound();
  }

  // 3. ดึงรายการชำระเงิน
  const { data: payments } = await admin
    .from('payments')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  const currentPayment = payments && payments.length > 0 ? payments[0] : null;

  // 4. สร้าง PromptPay QR ถ้าเป็นวิธี PromptPay
  let qrDataUrl: string | null = null;
  if (currentPayment?.method === 'promptpay' && shop.promptpay_id && order.total > 0) {
    try {
      qrDataUrl = await generatePromptPayQR(shop.promptpay_id, Number(order.total));
    } catch (e) {
      console.error('Failed to generate PromptPay QR:', e);
    }
  }

  return (
    <OrderTrackerClient
      initialOrder={order as Order}
      shop={shop as Shop}
      initialPayment={currentPayment as Payment | null}
      qrDataUrl={qrDataUrl}
    />
  );
}
