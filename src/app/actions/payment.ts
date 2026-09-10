'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { decryptApiKey } from '@/lib/crypto';
import { sendPushToShop } from '@/lib/push';
import { sendOrderStatusMessage } from '@/lib/telegram';
import { revalidatePath } from 'next/cache';

/**
 * ทำความสะอาดเลขบัญชี/พร้อมเพย์เพื่อเปรียบเทียบแบบ Exact Match
 */
function normalizeAccountNumber(account: string | null | undefined): string {
  if (!account) return '';
  return account.replace(/[^0-9]/g, '');
}

/**
 * แปลงข้อความ Error จาก SlipOK ให้เป็นภาษาไทยที่เข้าใจง่าย
 */
function translateSlipOkError(message: string | undefined, code?: number): string {
  if (!message) return 'ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  const lower = message.toLowerCase();

  if (lower.includes('qrcode not found') || lower.includes('qr not found') || lower.includes('barcode')) {
    return 'ไม่พบบาร์โค้ดในรูปภาพ กรุณาแนบรูปสลิปจากแอปธนาคารที่เห็น QR Code ชัดเจน';
  }
  if (lower.includes('duplicate') || lower.includes('already') || code === 1012) {
    return 'สลิปนี้เคยถูกใช้งานในระบบแล้ว ไม่สามารถใช้ซ้ำได้';
  }
  if (lower.includes('amount') || lower.includes('invalid amount')) {
    return 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ';
  }
  if (lower.includes('expired') || lower.includes('too old')) {
    return 'สลิปหมดอายุหรือไม่สามารถใช้งานได้';
  }
  if (lower.includes('invalid date') || lower.includes('time')) {
    return 'วันเวลาในสลิปไม่ถูกต้อง';
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('api key')) {
    return 'การเชื่อมต่อ SlipOK ของทางร้านไม่ถูกต้อง กรุณาติดต่อทางร้าน';
  }

  return message;
}

/**
 * Server Action: แนบรูปสลิปและส่งไปตรวจสอบกับ SlipOK API อัตโนมัติ
 */
export async function uploadAndVerifySlipAction(formData: FormData): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  try {
    const orderId = formData.get('order_id') as string;
    const slipFile = formData.get('slip') as File | null;

    if (!orderId) {
      return { success: false, error: 'ไม่พบรหัสคำสั่งซื้อ (order_id)' };
    }

    if (!slipFile || !(slipFile instanceof Blob) || slipFile.size === 0) {
      return { success: false, error: 'กรุณาเลือกไฟล์รูปภาพสลิปการโอนเงิน' };
    }

    // ตรวจสอบขนาดไฟล์ (ไม่เกิน 10MB)
    if (slipFile.size > 10 * 1024 * 1024) {
      return { success: false, error: 'ขนาดไฟล์ภาพสลิปต้องไม่เกิน 10MB' };
    }

    // ตรวจสอบประเภทไฟล์
    if (!slipFile.type.startsWith('image/')) {
      return { success: false, error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)' };
    }

    const admin = createAdminClient();

    // 1. ดึงข้อมูลคำสั่งซื้อและร้านค้า
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, order_no, shop_id, total, status, type, customer_name, telegram_chat_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'ไม่พบข้อมูลคำสั่งซื้อในระบบ' };
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      return { success: false, error: 'คำสั่งซื้อนี้เสร็จสิ้นหรือถูกยกเลิกไปแล้ว' };
    }

    // ตรวจสอบว่าชำระเงินไปแล้วหรือไม่
    const { data: existingPayment } = await admin
      .from('payments')
      .select('id, status, method')
      .eq('order_id', order.id)
      .eq('status', 'verified')
      .maybeSingle();

    if (existingPayment) {
      return { success: true, message: 'คำสั่งซื้อนี้ได้รับการยืนยันการชำระเงินเรียบร้อยแล้ว' };
    }

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id, name, promptpay_id, promptpay_name, telegram_enabled')
      .eq('id', order.shop_id)
      .single();

    if (shopError || !shop) {
      return { success: false, error: 'ไม่พบข้อมูลร้านค้า' };
    }

    // 2. ดึงการตั้งค่า SlipOK ของร้านค้า (ถอดรหัสฝั่ง Server)
    const { data: creds, error: credsError } = await admin
      .from('shop_payment_credentials')
      .select('api_key_encrypted, api_url, slip_check_provider')
      .eq('shop_id', shop.id)
      .single();

    if (credsError || !creds || !creds.api_key_encrypted) {
      return {
        success: false,
        error: 'ทางร้านยังไม่ได้ตั้งค่าระบบตรวจสลิปอัตโนมัติ (SlipOK) กรุณาติดต่อทางร้านโดยตรง',
      };
    }

    let decryptedApiKey: string;
    try {
      decryptedApiKey = decryptApiKey(creds.api_key_encrypted);
    } catch (e) {
      console.error('[Slip Verification] Failed to decrypt API key:', e);
      return { success: false, error: 'ระบบไม่สามารถถอดรหัสความปลอดภัยของร้านค้าได้ กรุณาติดต่อร้านค้า' };
    }

    // 3. กำหนด Endpoint URL ของ SlipOK
    let targetUrl = 'https://api.slipok.com/api/line/apikey/1';
    if (creds.api_url && creds.api_url.trim().length > 0) {
      const rawUrl = creds.api_url.trim();
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        targetUrl = rawUrl;
      } else {
        // หากกรอกเฉพาะ branch id หรือตัวเลข
        targetUrl = `https://api.slipok.com/api/line/apikey/${rawUrl}`;
      }
    }

    // 4. ส่งรูปภาพสลิปไปยัง SlipOK API
    const slipFormData = new FormData();
    slipFormData.append('files', slipFile, slipFile.name || 'slip.jpg');
    slipFormData.append('amount', String(order.total));
    slipFormData.append('log', 'true');

    let slipResponse: Response;
    try {
      slipResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'x-authorization': decryptedApiKey,
        },
        body: slipFormData,
      });
    } catch (fetchErr: any) {
      console.error('[SlipOK API Fetch Error]:', fetchErr);
      return {
        success: false,
        error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ตรวจสลิปได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      };
    }

    let resultJson: any;
    try {
      resultJson = await slipResponse.json();
    } catch (jsonErr) {
      console.error('[SlipOK JSON Parse Error]:', jsonErr);
      return {
        success: false,
        error: 'การตอบกลับจากระบบตรวจสลิปไม่ถูกต้อง (HTTP ' + slipResponse.status + ')',
      };
    }

    // 5. ตรวจสอบผลลัพธ์จาก SlipOK
    if (!slipResponse.ok || resultJson.success === false) {
      const msg = translateSlipOkError(resultJson.message || resultJson.error, resultJson.code);
      return { success: false, error: msg };
    }

    // แกะข้อมูลจาก Payload ของ SlipOK
    const payloadData = resultJson.data || resultJson;
    const transRef = payloadData.transRef || payloadData.ref || payloadData.transaction_ref;
    const slipAmount = Number(payloadData.amount || 0);
    const receiverAccount = normalizeAccountNumber(
      payloadData.receiver?.account?.value || payloadData.receiver_account || payloadData.account_no
    );

    if (!transRef) {
      return {
        success: false,
        error: 'ไม่พบรหัสอ้างอิงธุรกรรม (Transaction Ref) ในสลิป กรุณาแนบภาพสลิปที่ชัดเจน',
      };
    }

    // ตรวจสอบยอดเงิน (ยอดสลิปต้องไม่น้อยกว่ายอดบิล)
    const orderTotal = Number(order.total);
    if (slipAmount < orderTotal) {
      return {
        success: false,
        error: `ยอดเงินในสลิป (${slipAmount.toLocaleString('th-TH')} บาท) ไม่ครบตามยอดคำสั่งซื้อ (${orderTotal.toLocaleString('th-TH')} บาท)`,
      };
    }

    // ตรวจสอบบัญชีผู้รับเงิน (Exact Match หากมีข้อมูลบัญชีผู้รับในสลิป)
    const shopPromptpay = normalizeAccountNumber(shop.promptpay_id);
    if (receiverAccount && shopPromptpay && receiverAccount !== shopPromptpay) {
      return {
        success: false,
        error: 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีพร้อมเพย์ของทางร้าน',
      };
    }

    // 6. เรียก RPC verify_and_confirm_payment แบบ atomic
    const { data: rpcResult, error: rpcError } = await admin.rpc('verify_and_confirm_payment', {
      p_order_id: order.id,
      p_amount: slipAmount,
      p_trans_ref: transRef,
      p_raw_payload: resultJson,
    });

    if (rpcError) {
      if (rpcError.code === '23505' || rpcError.message?.includes('duplicate')) {
        return {
          success: false,
          error: 'สลิปนี้เคยถูกใช้งานในระบบแล้ว ไม่สามารถนำมาใช้ซ้ำได้ (รหัสอ้างอิงซ้ำ)',
        };
      }
      return {
        success: false,
        error: rpcError.message || 'เกิดข้อผิดพลาดในการบันทึกการยืนยันชำระเงิน',
      };
    }

    // 7. อัปโหลดภาพสลิปเก็บใน Supabase Storage ('payment-slips' bucket) แบบ Asynchronous/Best-effort
    try {
      const fileExt = slipFile.name ? slipFile.name.split('.').pop() || 'jpg' : 'jpg';
      const storagePath = `${shop.id}/${order.id}_${Date.now()}.${fileExt}`;
      const arrayBuffer = await slipFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await admin.storage
        .from('payment-slips')
        .upload(storagePath, buffer, {
          contentType: slipFile.type || 'image/jpeg',
          upsert: true,
        });
    } catch (storageErr) {
      console.warn('[Storage Slip Warning]: Failed to archive slip image to storage', storageErr);
    }

    // 8. แจ้งเตือนร้านค้าผ่าน Web Push
    try {
      await sendPushToShop(shop.id, {
        title: `💰 ชำระเงินแล้ว ออเดอร์ #${order.order_no}`,
        body: `ตรวจสลิป SlipOK สำเร็จ ยอด ${slipAmount.toLocaleString('th-TH')} บาท`,
        orderId: order.id,
        orderNo: order.order_no,
      });
    } catch (pushErr) {
      console.warn('[Push Notification Warning]:', pushErr);
    }

    // 9. แจ้งเตือนลูกค้าผ่าน Telegram Bot (ถ้าเชื่อมต่อไว้)
    if (order.telegram_chat_id && shop.telegram_enabled !== false) {
      try {
        await sendOrderStatusMessage(
          order.telegram_chat_id,
          'confirmed',
          order.order_no,
          shop.name || 'RAN-R-HAN'
        );
      } catch (tgErr) {
        console.warn('[Telegram Notification Warning]:', tgErr);
      }
    }

    revalidatePath(`/order/${order.id}`);
    revalidatePath('/admin');

    return {
      success: true,
      message: 'ตรวจสอบสลิปสำเร็จ! ชำระเงินเรียบร้อยแล้ว',
      data: rpcResult,
    };
  } catch (err: any) {
    console.error('[uploadAndVerifySlipAction Error]:', err);
    return {
      success: false,
      error: err?.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง',
    };
  }
}
