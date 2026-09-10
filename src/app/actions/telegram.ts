'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getTelegramBotUsername, isTelegramConfigured, sendTestTelegramMessage } from '@/lib/telegram';
import { revalidatePath } from 'next/cache';

/**
 * สร้าง Token สำหรับเชื่อมโยง Order กับ Telegram Chat ID (อายุ 15 นาที)
 * คืนค่า Deep Link URL: https://t.me/<username>?start=<token>
 */
export async function createTelegramLinkAction(orderId: string): Promise<{
  success: boolean;
  botUrl?: string;
  botUsername?: string;
  error?: string;
}> {
  try {
    if (!orderId) {
      return { success: false, error: 'Missing orderId' };
    }

    if (!isTelegramConfigured()) {
      return { success: false, error: 'ระบบยังไม่ได้ตั้งค่า Telegram Bot' };
    }

    const admin = createAdminClient();

    // 1. ตรวจสอบว่ามี order อยู่จริงหรือไม่
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, shop_id, shops (telegram_enabled)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'ไม่พบข้อมูลออเดอร์' };
    }

    const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
    if (shop && (shop as any).telegram_enabled === false) {
      return { success: false, error: 'ร้านค้านี้ปิดการแจ้งเตือน Telegram' };
    }

    // 2. สร้าง Token ในตาราง telegram_link_tokens
    const { data: tokenData, error: tokenError } = await admin
      .from('telegram_link_tokens')
      .insert({
        order_id: orderId,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used: false,
      })
      .select('token')
      .single();

    if (tokenError || !tokenData) {
      return { success: false, error: tokenError?.message || 'Failed to generate token' };
    }

    const botUsername = getTelegramBotUsername();
    const botUrl = `https://t.me/${botUsername}?start=${tokenData.token}`;

    return {
      success: true,
      botUrl,
      botUsername,
    };
  } catch (err: any) {
    console.error('createTelegramLinkAction error:', err);
    return { success: false, error: err.message || 'Internal error' };
  }
}

/**
 * สลับเปิด/ปิด การแจ้งเตือน Telegram สำหรับร้านค้านั้นๆ (Admin/Owner)
 */
export async function updateShopTelegramSettingsAction(
  shopId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('shops')
      .update({
        telegram_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) {
      return { success: false, error: error.message };
    }

    try {
      revalidatePath('/admin/settings');
    } catch {
      // safe in non-req context
    }

    return { success: true };
  } catch (err: any) {
    console.error('updateShopTelegramSettingsAction error:', err);
    return { success: false, error: err.message || 'Failed to update settings' };
  }
}

/**
 * ทดสอบส่งข้อความไปยัง Telegram Chat ID
 */
export async function sendTelegramTestAction(
  chatId: string,
  shopName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = chatId.trim();
    if (!cleanId) {
      return { success: false, error: 'กรุณาระบุ Telegram Chat ID' };
    }

    const res = await sendTestTelegramMessage(cleanId, shopName || 'RAN-R-HAN');
    return res;
  } catch (err: any) {
    console.error('sendTelegramTestAction error:', err);
    return { success: false, error: err.message || 'Failed to send test message' };
  }
}
