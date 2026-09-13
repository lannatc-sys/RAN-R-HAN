import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const botToken = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(chatId, text, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(chatId).trim(),
      text,
      parse_mode: parseMode,
    }),
  });
  return await res.json();
}

async function main() {
  let chatId = process.argv[2];

  if (!chatId) {
    // หาจากคำสั่งซื้อล่าสุดที่ผูกไว้
    const orderRes = await pool.query(
      'SELECT telegram_chat_id FROM orders WHERE telegram_chat_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1'
    );
    if (orderRes.rows.length > 0) {
      chatId = orderRes.rows[0].telegram_chat_id;
    } else {
      chatId = '5581598534';
    }
  }

  console.log(`🚀 กำลังส่งข้อความทดสอบไปยัง Telegram Chat ID: ${chatId}...`);

  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  // 1. ข้อความทดสอบระบบ
  const testMsg = `🔔 <b>ทดสอบระบบแจ้งเตือน RAN-R-HAN (แม่ฮ่องสอน)</b>\n\n` +
    `✅ <b>สถานะการเชื่อมต่อ:</b> สำเร็จ 100%\n` +
    `🤖 <b>Telegram Bot:</b> @ranrhan_bot\n` +
    `👤 <b>Chat ID:</b> <code>${chatId}</code>\n` +
    `⏰ <b>เวลาทดสอบ:</b> ${now}\n\n` +
    `🛵 บอทพร้อมส่งการแจ้งเตือนงานไรเดอร์และคิวอาหารเรียบร้อยครับ!`;

  const res1 = await sendTelegram(chatId, testMsg, 'HTML');
  console.log('Result Msg 1:', res1);

  if (res1.ok) {
    console.log('✅ ส่งข้อความที่ 1 สำเร็จเรียบร้อย! Message ID:', res1.result.message_id);

    // 2. ส่งข้อความจำลองงานไรเดอร์ (Rider Job Offer)
    const riderOfferMsg = `🛵 <b>มีงานจัดส่งใหม่เข้ามา! (จำลองระบบไรเดอร์)</b>\n\n` +
      `📦 <b>ออเดอร์:</b> #A001\n` +
      `🏪 <b>ร้าน:</b> ครัวป้าแดง (แม่ฮ่องสอน)\n` +
      `📍 <b>จัดส่งที่:</b> เทศบาลเมืองแม่ฮ่องสอน\n` +
      `📏 <b>ระยะทาง:</b> ~1.8 กม.\n` +
      `💵 <b>ค่าส่ง:</b> 35.00 บาท\n` +
      `⏱️ <b>เวลารับงาน:</b> ภายใน 45 วินาที\n\n` +
      `🔗 <a href="https://ran-r-han.vercel.app/rider">เปิดระบบ PWA ไรเดอร์</a>`;

    const res2 = await sendTelegram(chatId, riderOfferMsg, 'HTML');
    console.log('Result Msg 2 (Rider Simulation):', res2);

    // บันทึก Chat ID นี้เข้ากับ rider1.kruapa@gmail.com (สมชาย ขี่เร็ว) และ order ล่าสุด
    await pool.query(
      "UPDATE riders SET telegram_chat_id = $1 WHERE phone = '0891112233'",
      [String(chatId)]
    );
    console.log('✅ ผูก Chat ID เข้ากับไรเดอร์ 1 (สมชาย ขี่เร็ว) เรียบร้อย!');

    await pool.query(
      "UPDATE orders SET telegram_chat_id = $1 WHERE order_no = 'A001'",
      [String(chatId)]
    );
    console.log('✅ ผูก Chat ID เข้ากับ Order #A001 เรียบร้อย!');
  } else {
    console.error('❌ ส่งไม่สำเร็จ:', res1);
  }

  await pool.end();
}

main().catch(console.error);
