import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptApiKey } from '@/lib/crypto';
import { sendPushToShop } from '@/lib/push';

/**
 * ทำความสะอาดเลขบัญชี/พร้อมเพย์เพื่อเปรียบเทียบแบบ Exact Match
 */
function normalizeAccountNumber(account: string | null | undefined): string {
  if (!account) return '';
  return account.replace(/[^0-9]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    // 1. ตรวจสอบ Secret Header ถ้ามีการตั้งค่า
    const expectedSecret = process.env.SLIPOK_WEBHOOK_SECRET;
    if (expectedSecret) {
      const incomingSecret = req.headers.get('x-slipok-secret') || req.headers.get('x-webhook-secret');
      if (incomingSecret !== expectedSecret) {
        return NextResponse.json({ error: 'UNAUTHORIZED: Secret header mismatch' }, { status: 401 });
      }
    }

    const payload = await req.json();

    // ตัวอย่างโครงสร้าง payload จาก SlipOK
    // { data: { transRef, amount, receiver: { account: { value: '0812345678' }, name: '...' }, ref1, ref2 } }
    const slipData = payload.data || payload;
    const transRef = slipData.transRef || slipData.transaction_ref || slipData.ref || slipData.trans_ref;
    const amount = Number(slipData.amount || 0);
    const orderId = slipData.ref1 || slipData.order_id || slipData.orderId;
    const receiverAccount = normalizeAccountNumber(
      slipData.receiver?.account?.value || slipData.receiver_account || slipData.account_no
    );

    if (!orderId || !transRef || !amount) {
      return NextResponse.json(
        { error: 'BAD_REQUEST: Missing orderId, transRef, or amount in slip payload' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 2. ดึงข้อมูลคำสั่งซื้อและร้านค้า
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, order_no, shop_id, total, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'ORDER_NOT_FOUND: Order not found' }, { status: 404 });
    }

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id, name, promptpay_id, promptpay_name')
      .eq('id', order.shop_id)
      .single();

    if (shopError || !shop) {
      return NextResponse.json({ error: 'SHOP_NOT_FOUND: Shop not found' }, { status: 404 });
    }

    // 3. ดึง API key ของร้านจาก shop_payment_credentials (ถอดรหัสเฉพาะฝั่ง server)
    const { data: creds } = await admin
      .from('shop_payment_credentials')
      .select('api_key_encrypted, slip_check_provider')
      .eq('shop_id', shop.id)
      .single();

    if (creds && creds.api_key_encrypted) {
      try {
        // ถอดรหัสเพื่อนำไปใช้ยืนยันกับ SlipOK API ถ้าจำเป็น
        const decryptedApiKey = decryptApiKey(creds.api_key_encrypted);
        // หมายเหตุ: ห้าม console.log(decryptedApiKey) ตามข้อกำหนดความปลอดภัย
      } catch (err) {
        // ถ้า decrypt ไม่ผ่าน ให้ log เตือนแต่ไม่เปิดเผย secret
        console.error('[SlipOK Webhook] Failed to decrypt shop payment credentials');
      }
    }

    // 4. ตรวจสอบบัญชีปลายทางแบบ Exact Match
    const shopPromptpay = normalizeAccountNumber(shop.promptpay_id);
    if (receiverAccount && shopPromptpay && receiverAccount !== shopPromptpay) {
      return NextResponse.json(
        { error: 'ACCOUNT_MISMATCH: บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีของร้านค้า' },
        { status: 400 }
      );
    }

    // 5. เรียก RPC verify_and_confirm_payment แบบ atomic
    const { data: result, error: rpcError } = await admin.rpc('verify_and_confirm_payment', {
      p_order_id: order.id,
      p_amount: amount,
      p_trans_ref: transRef,
      p_raw_payload: payload,
    });

    if (rpcError) {
      // ตรวจจับ error กรณีสลิปซ้ำผ่าน error.code === '23505'
      if (rpcError.code === '23505') {
        return NextResponse.json(
          { error: 'DUPLICATE_SLIP: สลิปนี้ถูกใช้งานไปแล้ว' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    // 6. ส่ง Web Push แจ้งเตือนไปยังพนักงานในร้าน
    await sendPushToShop(shop.id, {
      title: `ชำระเงินสำเร็จ: ออเดอร์ #${order.order_no}`,
      body: `ยอด ${amount.toLocaleString('th-TH')} บาท (พร้อมเพย์) กำลังเตรียมอาหาร`,
      orderId: order.id,
      orderNo: order.order_no,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'DUPLICATE_SLIP: สลิปนี้ถูกใช้งานไปแล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
