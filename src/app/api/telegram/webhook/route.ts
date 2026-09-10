import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ตรวจสอบว่ามี message และ chat id หรือไม่
    const message = body?.message;
    if (!message || !message.chat || !message.chat.id) {
      return NextResponse.json({ ok: true, note: 'ignored_non_message' });
    }

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    // ตรวจจับคำสั่ง /start
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const token = parts[1]?.trim();

      // กรณี /start ธรรมดา ไม่มี Token
      if (!token) {
        await sendTelegramMessage(
          chatId,
          `👋 *ยินดีต้อนรับสู่ระบบแจ้งเตือน RAN-R-HAN (รับอาหาร)*\n\nบอทนี้มีหน้าที่แจ้งเตือนสถานะคิวอาหารของคุณโดยอัตโนมัติ 🍲\n\n💡 *วิธีใช้งาน:* สั่งอาหารผ่านหน้าเว็บร้านค้า แล้วกดปุ่ม *"รับแจ้งเตือนผ่าน Telegram"* หลังยืนยันสั่งซื้อ เพื่อเชื่อมต่อคิวของคุณค่ะ`,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // ตรวจสอบ Token ในฐานข้อมูล
      const admin = createAdminClient();
      const { data: tokenRecord, error } = await admin
        .from('telegram_link_tokens')
        .select(`
          token,
          order_id,
          expires_at,
          used,
          orders (
            id,
            order_no,
            shop_id,
            shops (
              name
            )
          )
        `)
        .eq('token', token)
        .maybeSingle();

      if (error || !tokenRecord) {
        await sendTelegramMessage(
          chatId,
          `⚠️ *ไม่พบข้อมูลคำขอเชื่อมต่อ*\n\nรหัสลิงก์อาจไม่ถูกต้อง หรือถูกลบออกจากระบบแล้ว กรุณากดลิงก์จากหน้าสั่งซื้อใหม่อีกครั้งค่ะ`,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // ตรวจสอบว่าใช้งานไปแล้วหรือไม่
      if (tokenRecord.used) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ *ออเดอร์นี้ได้รับการเชื่อมต่อแล้ว*\n\nคุณได้เชื่อมต่อการแจ้งเตือนสำหรับออเดอร์นี้ไว้เรียบร้อยแล้วค่ะ รอรับข้อความเมื่ออาหารพร้อมได้เลย! ✨`,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // ตรวจสอบเวลาหมดอายุ (15 นาที)
      if (new Date(tokenRecord.expires_at) < new Date()) {
        await sendTelegramMessage(
          chatId,
          `⏰ *ลิงก์เชื่อมต่อหมดอายุแล้ว*\n\nลิงก์เชื่อมต่อมีอายุ 15 นาทีเพื่อความปลอดภัย กรุณากลับไปที่หน้าร้านเพื่อรับลิงก์ใหม่อีกครั้งค่ะ`,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // บันทึก chat_id ลงในตาราง orders
      const order = Array.isArray(tokenRecord.orders) ? tokenRecord.orders[0] : tokenRecord.orders;
      const orderId = tokenRecord.order_id;

      await admin
        .from('orders')
        .update({
          telegram_chat_id: String(chatId),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      // มาร์ก Token ว่าใช้งานแล้ว
      await admin
        .from('telegram_link_tokens')
        .update({ used: true })
        .eq('token', token);

      // ดึงข้อมูลร้านและเลขคิว
      const orderNo = String(order?.order_no || '').padStart(4, '0');
      const shopName = (order as any)?.shops?.name || 'RAN-R-HAN';

      // ส่งข้อความยืนยันความสำเร็จกลับหาลูกค้า
      await sendTelegramMessage(
        chatId,
        `✅ *เชื่อมต่อการแจ้งเตือนสำเร็จ!*\n\nยินดีด้วยค่ะ คุณได้เชื่อมต่อกับออเดอร์คิว *#${orderNo}* ของร้าน *${shopName}* เรียบร้อยแล้ว\n\nระบบจะส่งข้อความแจ้งเตือนทันทีเมื่อทางร้านรับออเดอร์และปรุงอาหารเสร็จค่ะ 🍽️✨`,
        { parse_mode: 'Markdown' }
      );

      return NextResponse.json({ ok: true });
    }

    // ข้อความอื่นๆ ที่ไม่ใช่ /start
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'RAN-R-HAN Telegram Webhook',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
