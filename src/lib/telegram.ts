/**
 * Telegram Bot Helper Library
 * File: src/lib/telegram.ts
 * Description: ฟังก์ชันสำหรับเชื่อมต่อและส่งข้อความผ่าน Telegram Bot API
 */

export function getTelegramBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.TEREGRAM_API_BOT_TOKEN;
}

export function getTelegramBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || 'ranrhan_bot';
}

export function isTelegramConfigured(): boolean {
  const token = getTelegramBotToken();
  return Boolean(token && token.trim().length > 0);
}

export interface SendTelegramOptions {
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
}

/**
 * ส่งข้อความไปยัง Telegram Chat ID ผ่าน Telegram Bot API
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendTelegramOptions = { parse_mode: 'Markdown' }
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  const cleanChatId = String(chatId).trim();
  if (!cleanChatId) {
    return { success: false, error: 'Invalid or missing chatId' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: options.parse_mode || 'Markdown',
        disable_web_page_preview: options.disable_web_page_preview ?? true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error('[Telegram] Send message failed:', data);
      return {
        success: false,
        error: data.description || `Telegram API responded with status ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
    };
  } catch (err: any) {
    console.error('[Telegram] Network or unexpected error:', err);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Telegram request timed out' : (err.message || 'Unknown network error'),
    };
  }
}

/**
 * จัดรูปแบบข้อความแจ้งเตือนตามสถานะออเดอร์ (TH / EN)
 */
export function formatOrderStatusText(
  status: 'confirmed' | 'cooking' | 'served' | 'completed' | 'cancelled' | string,
  orderNo: string | number,
  shopName: string,
  lang: 'th' | 'en' = 'th'
): string {
  const cleanShop = shopName || 'ร้านอาหาร';
  const cleanOrder = String(orderNo || '').padStart(4, '0');

  if (lang === 'en') {
    switch (status) {
      case 'confirmed':
        return `✅ *${cleanShop}* confirmed order #${cleanOrder}!\nYour order has been queued into the kitchen.`;
      case 'cooking':
        return `👨‍🍳 *Cooking Now!*\nOrder #${cleanOrder} (${cleanShop}) is currently being prepared.`;
      case 'served':
        return `🎉 *Order Ready for Pickup!*\nOrder #${cleanOrder} (${cleanShop}) is ready. Please pick up at the counter.`;
      case 'completed':
        return `🙏 *Order #${cleanOrder} Completed*\nThank you for choosing *${cleanShop}*. Enjoy your meal!`;
      case 'cancelled':
        return `❌ *Order #${cleanOrder} Cancelled*\nYour order at ${cleanShop} has been cancelled. Please contact the shop if you have questions.`;
      default:
        return `ℹ️ Order #${cleanOrder} status updated to: ${status} (${cleanShop})`;
    }
  }

  // ภาษาไทย (Default)
  switch (status) {
    case 'confirmed':
      return `✅ ร้าน *${cleanShop}* รับออเดอร์คิว #${cleanOrder} แล้ว\nทางร้านกำลังเตรียมคิวอาหารเข้าครัวค่ะ 🍳`;
    case 'cooking':
      return `👨‍🍳 *กำลังปรุงอาหาร!*\nออเดอร์คิว #${cleanOrder} (${cleanShop}) อยู่ในกระทะแล้ว รออีกนิดนะคะ`;
    case 'served':
      return `🎉 *อาหารเสร็จแล้วพร้อมรับ!*\nออเดอร์คิว #${cleanOrder} (${cleanShop}) ปรุงเสร็จเรียบร้อยแล้ว เชิญมารับอาหารได้เลยครับ 🍽️`;
    case 'completed':
      return `🙏 *ออเดอร์คิว #${cleanOrder} ดำเนินการเสร็จสมบูรณ์*\nขอบคุณที่อุดหนุนร้าน *${cleanShop}* นะคะ ทานให้อร่อยครับ! ✨`;
    case 'cancelled':
      return `❌ *ออเดอร์คิว #${cleanOrder} ถูกยกเลิก*\nออเดอร์ของคุณที่ร้าน ${cleanShop} ถูกยกเลิก หากมีข้อสงสัยติดต่อทางร้านได้โดยตรงนะคะ`;
    default:
      return `ℹ️ อัปเดตสถานะออเดอร์ #${cleanOrder}: ${status} (ร้าน ${cleanShop})`;
  }
}

/**
 * ส่งข้อความแจ้งเตือนสถานะออเดอร์ไปยังลูกค้า
 */
export async function sendOrderStatusMessage(
  chatId: string | number,
  status: 'confirmed' | 'cooking' | 'served' | 'completed' | 'cancelled' | string,
  orderNo: string | number,
  shopName: string,
  lang: 'th' | 'en' = 'th'
): Promise<{ success: boolean; error?: string }> {
  const text = formatOrderStatusText(status, orderNo, shopName, lang);
  return sendTelegramMessage(chatId, text, { parse_mode: 'Markdown' });
}

/**
 * ส่งข้อความทดสอบจากหน้าตั้งค่าร้านค้า
 */
export async function sendTestTelegramMessage(
  chatId: string | number,
  shopName: string = 'RAN-R-HAN'
): Promise<{ success: boolean; error?: string }> {
  const botUsername = getTelegramBotUsername();
  const text = `🔔 *ทดสอบการแจ้งเตือนจาก ${shopName}*\n\nระบบเชื่อมต่อ Telegram Bot (@${botUsername}) เรียบร้อยแล้ว! พร้อมรับการแจ้งเตือนสถานะออเดอร์ทันทีเมื่ออาหารพร้อมเสิร์ฟ ✅`;
  return sendTelegramMessage(chatId, text, { parse_mode: 'Markdown' });
}
