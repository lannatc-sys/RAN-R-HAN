import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { answerTelegramCallback, sendTelegramMessage } from '@/lib/telegram';
import {
  memberOfShop,
  ownsRider,
  resolveTelegramIdentity,
  type ResolvedTelegramIdentity,
} from '@/lib/telegram-identity';
import {
  HELP_TEXT,
  VERIFY_PROMPT_TEXT,
  buildMainMenu,
  buildRiderMenu,
  buildShopHome,
  buildShopMenu,
  buildShopPicker,
  miniAppButton,
} from '@/lib/telegram-menu';
import {
  accountText,
  myOrdersText,
  riderJobsText,
  riderStatusText,
  riderSummaryText,
  settlementText,
  shopStatusText,
} from '@/lib/telegram-queries';

type Keyboard = { text: string; callback_data?: string; web_app?: { url: string } }[][];

function toReplyMarkup(keyboard: { text: string; callback_data?: string; web_app_url?: string }[][]): {
  inline_keyboard: Keyboard;
} {
  return {
    inline_keyboard: keyboard.map((row) =>
      row.map((b) =>
        b.web_app_url
          ? { text: b.text, web_app: { url: b.web_app_url } }
          : { text: b.text, callback_data: b.callback_data ?? 'm:menu' }
      )
    ),
  };
}

async function sendMenu(chatId: number, identity: ResolvedTelegramIdentity) {
  const menu = buildMainMenu(identity);
  await sendTelegramMessage(chatId, menu.text, {
    parse_mode: 'Markdown',
    reply_markup: toReplyMarkup(menu.keyboard),
  });
}

/** Verify-token announce: record which Telegram account opened the link. */
async function handleVerifyTokenStart(admin: any, chatId: number, token: string) {
  const { data: row } = await admin
    .from('telegram_verify_tokens')
    .select('token, user_id, telegram_user_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    await sendTelegramMessage(
      chatId,
      `⚠️ *ลิงก์ยืนยันใช้ไม่ได้*\n\nอาจหมดอายุหรือถูกใช้ไปแล้ว กรุณาสร้างลิงก์ใหม่จากหน้าเว็บค่ะ`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (row.telegram_user_id && Number(row.telegram_user_id) !== chatId) {
    await sendTelegramMessage(
      chatId,
      `⚠️ *ลิงก์นี้ถูกเปิดด้วยบัญชีอื่นแล้ว*\n\nกรุณาใช้บัญชี Telegram เดิมที่เปิดลิงก์ครั้งแรกค่ะ`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await admin
    .from('telegram_verify_tokens')
    .update({ telegram_user_id: chatId })
    .eq('token', token);

  await sendTelegramMessage(
    chatId,
    `🔐 *รับทราบค่ะ*\n\nกลับไปที่หน้าเว็บแล้วกด *"ยืนยันการเชื่อม"* เพื่อผูกบัญชีนี้ให้เสร็จค่ะ`,
    { parse_mode: 'Markdown' }
  );
}

async function handleCallback(admin: any, query: any) {
  const chatId = Number(query?.message?.chat?.id);
  const data = String(query?.data || '');
  const queryId = String(query?.id || '');
  if (!chatId || !data) {
    if (queryId) await answerTelegramCallback(queryId);
    return;
  }

  const identity = await resolveTelegramIdentity(admin, query.from?.id);
  if (!identity) {
    await answerTelegramCallback(queryId, 'กรุณายืนยันตัวตนก่อน');
    await sendTelegramMessage(chatId, VERIFY_PROMPT_TEXT, { parse_mode: 'Markdown' });
    return;
  }

  const ack = (t?: string) => answerTelegramCallback(queryId, t);
  const send = (text: string, keyboard?: { text: string; callback_data?: string; web_app_url?: string }[][]) =>
    sendTelegramMessage(chatId, text, {
      parse_mode: 'Markdown',
      ...(keyboard ? { reply_markup: toReplyMarkup(keyboard) } : {}),
    });

  // Main navigation -----------------------------------------------------------
  if (data === 'm:noop') {
    await ack();
    return;
  }
  if (data === 'm:menu') {
    await ack();
    await sendMenu(chatId, identity);
    return;
  }
  if (data === 'm:shop') {
    await ack();
    if (identity.shops.length === 0) {
      await send('🏪 คุณยังไม่มีร้านที่ดูแลค่ะ');
      return;
    }
    const menu = buildShopMenu(identity);
    await send(menu.text, menu.keyboard);
    return;
  }
  if (data === 'm:rider') {
    await ack();
    if (identity.riders.length === 0) {
      await send('🛵 คุณยังไม่มี rider identity ที่ผูกไว้ค่ะ');
      return;
    }
    const menu = buildRiderMenu();
    await send(menu.text, menu.keyboard);
    return;
  }
  if (data === 'm:acct') {
    await ack();
    await send(accountText(identity));
    return;
  }
  if (data === 'm:help') {
    await ack();
    await send(HELP_TEXT);
    return;
  }

  // Orders --------------------------------------------------------------------
  if (data === 'o:mine') {
    await ack();
    await send(await myOrdersText(admin, identity));
    return;
  }

  // Shops ---------------------------------------------------------------------
  if (data === 's:list') {
    await ack();
    if (identity.shops.length === 1) {
      const home = buildShopHome(identity.shops[0]);
      await send(
        `${home.text}\n${await shopStatusText(admin, identity.shops[0].shop_id, identity.shops[0].shop_name)}`,
        home.keyboard
      );
    } else {
      const picker = buildShopPicker(identity.shops);
      await send(picker.text, picker.keyboard);
    }
    return;
  }

  const shopMatch = data.match(/^s:([0-9a-f-]{36})(?::(orders|toggle))?$/i);
  if (shopMatch) {
    const shopId = shopMatch[1];
    const op = shopMatch[2];
    if (!memberOfShop(identity, shopId)) {
      await ack('ไม่มีสิทธิ์ร้านนี้');
      return;
    }
    const shop = identity.shops.find((s) => s.shop_id === shopId)!;
    if (op === 'orders') {
      await ack();
      const scoped = { ...identity, shops: [shop] };
      await send(await myOrdersText(admin, scoped));
      return;
    }
    if (op === 'toggle') {
      if (shop.role !== 'owner' && shop.role !== 'superadmin' && !identity.is_superadmin) {
        await ack('เฉพาะเจ้าของร้าน');
        return;
      }
      const { data: current } = await admin
        .from('shops')
        .select('is_open')
        .eq('id', shopId)
        .maybeSingle();
      const next = !(current?.is_open ?? false);
      const { error } = await admin.rpc('telegram_shop_set_open', {
        p_actor: identity.user_id,
        p_shop_id: shopId,
        p_is_open: next,
      });
      await ack(error ? 'เปลี่ยนสถานะไม่สำเร็จ' : next ? 'เปิดร้านแล้ว' : 'ปิดร้านแล้ว');
      await send(await shopStatusText(admin, shopId, shop.shop_name));
      return;
    }
    await ack();
    const home = buildShopHome(shop);
    await send(
      `${home.text}\n${await shopStatusText(admin, shopId, shop.shop_name)}`,
      home.keyboard
    );
    return;
  }

  // Rider ---------------------------------------------------------------------
  if (data === 'r:status') {
    await ack();
    await send(await riderStatusText(admin, identity));
    return;
  }
  if (data === 'r:summary') {
    await ack();
    await send(await riderSummaryText(admin, identity));
    return;
  }
  if (data === 'r:offers') {
    await ack();
    const text = await riderJobsText(admin, identity);
    const riderIds = identity.riders.map((r) => r.rider_id);
    const { data: offers } = await admin
      .from('dispatch_offers')
      .select('id, timeout_at')
      .in('rider_id', riderIds)
      .eq('status', 'offered');
    const live = (offers ?? [])
      .filter((o: any) => !o.timeout_at || new Date(o.timeout_at) > new Date())
      .slice(0, 3);
    const keyboard: { text: string; callback_data?: string; web_app_url?: string }[][] = live.flatMap((o: any) => [[
      { text: `✅ รับ ${String(o.id).slice(0, 8)}`, callback_data: `of:${o.id}:accept` },
      { text: `❌ ปฏิเสธ`, callback_data: `of:${o.id}:reject` },
    ]]);
    const riderApp = miniAppButton('🛵 เปิดแอปไรเดอร์', 'rider');
    if (riderApp) keyboard.push([{ text: riderApp.text, web_app_url: riderApp.web_app_url }]);
    await send(text, keyboard.length > 0 ? keyboard : undefined);
    return;
  }

  const offerMatch = data.match(/^of:([0-9a-f-]{36}):(accept|reject)$/i);
  if (offerMatch) {
    const [, offerId, action] = offerMatch;
    const { data: offer } = await admin
      .from('dispatch_offers')
      .select('id, rider_id')
      .eq('id', offerId)
      .maybeSingle();
    if (!offer || !ownsRider(identity, String(offer.rider_id))) {
      await ack('งานนี้ไม่ใช่ของคุณ');
      return;
    }
    const { error } = await admin.rpc('telegram_offer_respond', {
      p_actor: identity.user_id,
      p_offer_id: offerId,
      p_action: action,
    });
    const errText = error ? String((error as any)?.message ?? error) : '';
    await ack(
      !error
        ? action === 'accept'
          ? 'รับงานแล้ว'
          : 'ปฏิเสธแล้ว'
        : errText.includes('RIDER_CAPACITY_REACHED')
          ? 'รับงานซ้อนเกิน 2 งานแล้ว ส่งงานปัจจุบันก่อนนะคะ'
          : 'ตอบรับไม่สำเร็จ สถานะอาจเปลี่ยนแล้ว'
    );
    await send(await riderJobsText(admin, identity));
    return;
  }

  // Settlement ------------------------------------------------------------------
  if (data === 'st:menu') {
    await ack();
    if (identity.shops.length === 1 && !identity.is_superadmin) {
      const s = identity.shops[0];
      await send(await settlementText(admin, s.shop_id, s.shop_name));
    } else if (identity.shops.length > 0) {
      await send(
        '💰 *เลือกดู settlement รายร้าน*',
        identity.shops.map((s) => [{ text: s.shop_name, callback_data: `st:${s.shop_id}` }])
      );
    } else if (identity.is_superadmin) {
      const { data: all } = await admin
        .from('shops')
        .select('id, name')
        .order('name')
        .limit(20);
      await send(
        '💰 *เลือกดู settlement รายร้าน*',
        (all ?? []).map((s: any) => [{ text: String(s.name), callback_data: `st:${s.id}` }])
      );
    } else {
      await send('💰 คุณยังไม่มีร้านที่ดูแลค่ะ');
    }
    return;
  }
  const settleMatch = data.match(/^st:([0-9a-f-]{36})$/i);
  if (settleMatch) {
    const shopId = settleMatch[1];
    if (!memberOfShop(identity, shopId)) {
      await ack('ไม่มีสิทธิ์ร้านนี้');
      return;
    }
    const shop = identity.shops.find((s) => s.shop_id === shopId);
    let shopName = shop?.shop_name ?? 'ร้านค้า';
    if (!shop && identity.is_superadmin) {
      const { data: row } = await admin.from('shops').select('name').eq('id', shopId).maybeSingle();
      if (row?.name) shopName = String(row.name);
    }
    await ack();
    await send(await settlementText(admin, shopId, shopName));
    return;
  }

  // Superadmin-only ---------------------------------------------------------------
  if (data === 'map:menu') {
    await ack();
    if (!identity.is_superadmin) {
      await send('⛔ เมนูนี้เฉพาะ superadmin ค่ะ');
      return;
    }
    const btn = miniAppButton('📍 เปิด Service Area Map', 'service-area');
    await send(
      '📍 *GPS / พื้นที่บริการ*\nดูภาพรวมแบบเรียลไทม์ที่หน้า Rider Live Monitor หรือเปิดแผนที่พื้นที่',
      btn ? [[{ text: btn.text, web_app_url: btn.web_app_url }]] : undefined
    );
    return;
  }
  if (data === 'n:menu') {
    await ack();
    if (!identity.is_superadmin) {
      await send('⛔ เมนูนี้เฉพาะ superadmin ค่ะ');
      return;
    }
    await send('🔔 ส่ง test notification มาที่บัญชีนี้แล้วค่ะ');
    await sendTelegramMessage(chatId, '🔔 *ทดสอบการแจ้งเตือน*\nระบบ gateway ทำงานปกติค่ะ', {
      parse_mode: 'Markdown',
    });
    return;
  }

  // Unlink ------------------------------------------------------------------------
  if (data === 'unlink') {
    await ack();
    await send('⚠️ *ยกเลิกการผูกบัญชี?*\nหลังจากนี้บอทจะไม่รู้จักคุณจนกว่าจะยืนยันใหม่', [
      [{ text: 'ยืนยันยกเลิก', callback_data: 'unlink:yes' }],
      [{ text: '◀️ กลับ', callback_data: 'm:menu' }],
    ]);
    return;
  }
  if (data === 'unlink:yes') {
    await admin
      .from('telegram_identities')
      .update({ revoked_at: new Date().toISOString() })
      .eq('telegram_user_id', identity.telegram_user_id)
      .is('revoked_at', null);
    await ack('ยกเลิกแล้ว');
    await send('✅ ยกเลิกการผูกเรียบร้อย ใช้ /start เพื่อยืนยันใหม่ได้ทุกเมื่อค่ะ');
    return;
  }

  await ack();
}

export async function POST(req: NextRequest) {
  try {
    // Telegram ส่ง header นี้มาทุก request ถ้าตั้ง secret_token ตอน setWebhook
    // ไม่ตรวจ = ใครก็ยิง payload ปลอมเข้ามาสั่งบอทได้
    // fail-closed: ไม่ตั้ง env = ปฏิเสธทุก request ไม่ใช่ปล่อยผ่าน
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[telegram/webhook] TELEGRAM_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
    }
    if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const admin = createAdminClient();

    // 1. Inline callbacks — verify identity + ownership on every action.
    if (body?.callback_query) {
      await handleCallback(admin, body.callback_query);
      return NextResponse.json({ ok: true });
    }

    // ตรวจสอบว่ามี message และ chat id หรือไม่
    const message = body?.message;
    if (!message || !message.chat || !message.chat.id) {
      return NextResponse.json({ ok: true, note: 'ignored_non_message' });
    }

    const chatId = Number(message.chat.id);
    const fromId = Number(message.from?.id);
    const text = (message.text || '').trim();

    const [command] = text.split(/\s+/);

    // 2. Text commands for verified users.
    if (command === '/menu' || command === '/account' || command === '/unlink' || command === '/help') {
      const identity = await resolveTelegramIdentity(admin, fromId);
      if (!identity) {
        await sendTelegramMessage(chatId, VERIFY_PROMPT_TEXT, { parse_mode: 'Markdown' });
        return NextResponse.json({ ok: true });
      }
      if (command === '/menu') {
        await sendMenu(chatId, identity);
        return NextResponse.json({ ok: true });
      }
      if (command === '/account') {
        await sendTelegramMessage(chatId, accountText(identity), { parse_mode: 'Markdown' });
        return NextResponse.json({ ok: true });
      }
      if (command === '/help') {
        await sendTelegramMessage(chatId, HELP_TEXT, { parse_mode: 'Markdown' });
        return NextResponse.json({ ok: true });
      }
      // /unlink — revoke this account immediately (already identity-verified).
      await admin
        .from('telegram_identities')
        .update({ revoked_at: new Date().toISOString() })
        .eq('telegram_user_id', identity.telegram_user_id)
        .is('revoked_at', null);
      await sendTelegramMessage(
        chatId,
        '✅ ยกเลิกการผูกเรียบร้อย ใช้ /start เพื่อยืนยันใหม่ได้ทุกเมื่อค่ะ',
        { parse_mode: 'Markdown' }
      );
      return NextResponse.json({ ok: true });
    }

    // 3. /start with a payload: order link (existing customer flow) or
    // verify token (gateway identity flow). Verify tokens are checked first
    // so identity binding can never be mistaken for an order link.
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const token = parts[1]?.trim();

      // กรณี /start ธรรมดา ไม่มี Token
      if (!token) {
        const identity = await resolveTelegramIdentity(admin, fromId);
        if (identity) {
          await sendMenu(chatId, identity);
          return NextResponse.json({ ok: true });
        }
        // Unverified without token: verify prompt. The legacy customer hint
        // is kept so existing order-link users are not stranded.
        await sendTelegramMessage(
          chatId,
          `${VERIFY_PROMPT_TEXT}\n\n💡 ถ้าคุณเพิ่งสั่งอาหารและต้องการรับแจ้งเตือนคิว ให้กดปุ่ม *"รับแจ้งเตือนผ่าน Telegram"* จากหน้าสั่งซื้ออีกครั้งค่ะ`,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // 3a. Gateway verify token?
      const { data: verifyRow } = await admin
        .from('telegram_verify_tokens')
        .select('token')
        .eq('token', token)
        .maybeSingle();
      if (verifyRow) {
        await handleVerifyTokenStart(admin, chatId, token);
        return NextResponse.json({ ok: true });
      }

      // 3b. Legacy order link token (customer flow — unchanged).
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
