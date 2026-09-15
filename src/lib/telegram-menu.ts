/**
 * Role-based Telegram menus (operational gateway).
 *
 * A button is only included when the verified identity actually holds the
 * role. Every callback payload is re-verified server-side (identity,
 * membership, resource ownership) before anything happens — the payload
 * itself is never trusted.
 */
import type {
  ResolvedTelegramIdentity,
  TelegramShopMembership,
} from './telegram-identity';

export interface TelegramButton {
  text: string;
  callback_data?: string;
  /** Mini App URL; only set when the app base URL is configured. */
  web_app_url?: string;
}

export type TelegramKeyboard = TelegramButton[][];

/** Mini App targets. Keys map to in-app routes; shop scope appended. */
const MINI_APP_PATHS: Record<string, string> = {
  kds: '/admin/kds',
  settings: '/admin/settings',
  'service-area': '/superadmin/service-area-map',
  rider: '/rider',
  settlement: '/admin/settlement',
  admin: '/superadmin',
};

function appBaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  return raw.length > 0 ? raw : null;
}

/** Build a Mini App button, or null when the base URL is not configured. */
export function miniAppButton(
  text: string,
  key: string,
  shopId?: string
): TelegramButton | null {
  const base = appBaseUrl();
  const path = MINI_APP_PATHS[key];
  if (!base || !path) return null;
  const url = shopId ? `${base}${path}?shop=${encodeURIComponent(shopId)}` : `${base}${path}`;
  return { text, web_app_url: url };
}

/** Main menu for a verified identity. Unverified callers never reach here. */
export function buildMainMenu(identity: ResolvedTelegramIdentity): {
  text: string;
  keyboard: TelegramKeyboard;
} {
  const rows: TelegramKeyboard = [];
  const hasShops = identity.shops.length > 0;
  const hasRider = identity.riders.length > 0;

  if (hasShops) {
    rows.push([{ text: '📦 ออเดอร์ของฉัน', callback_data: 'o:mine' }]);
    rows.push([
      identity.shops.length === 1
        ? { text: '🏪 ร้านค้าของฉัน', callback_data: `s:${identity.shops[0].shop_id}` }
        : { text: '🏪 ร้านค้าของฉัน', callback_data: 's:list' },
    ]);
  }
  if (hasRider) {
    rows.push([{ text: '🛵 ไรเดอร์', callback_data: 'r:status' }]);
    rows.push([{ text: '📋 งานของฉัน', callback_data: 'r:offers' }]);
  }
  if (hasShops || identity.is_superadmin) {
    rows.push([{ text: '💰 รายได้ / Settlement', callback_data: 'st:menu' }]);
  }
  if (identity.is_superadmin) {
    rows.push([{ text: '📍 GPS / พื้นที่บริการ', callback_data: 'map:menu' }]);
    rows.push([{ text: '🔔 การแจ้งเตือน', callback_data: 'n:menu' }]);
  }
  rows.push([{ text: '👤 บัญชีของฉัน', callback_data: 'm:acct' }]);
  rows.push([{ text: '❓ ช่วยเหลือ', callback_data: 'm:help' }]);

  const roleBits: string[] = [];
  if (identity.is_superadmin) roleBits.push('superadmin');
  else {
    const roles = new Set(identity.shops.map((s) => s.role));
    if (roles.size > 0) roleBits.push(`ร้าน(${[...roles].join('/')})`);
    if (hasRider) roleBits.push('ไรเดอร์');
  }
  return {
    text: `🏠 *เมนูหลัก*\nสิทธิ์ของคุณ: ${roleBits.join(' · ') || 'ผู้ใช้ทั่วไป'}`,
    keyboard: rows,
  };
}

/** Shop picker when the identity holds more than one shop. */
export function buildShopPicker(shops: TelegramShopMembership[]): {
  text: string;
  keyboard: TelegramKeyboard;
} {
  return {
    text: '🏪 *เลือกร้าน* — ทุกคำสั่งถัดไปจะใช้ร้านนี้',
    keyboard: shops.map((s) => [
      { text: `${s.shop_name} (${s.role})`, callback_data: `s:${s.shop_id}` },
    ]),
  };
}

/** Per-shop home: status summary is filled by the caller, actions here. */
export function buildShopHome(shop: TelegramShopMembership): {
  text: string;
  keyboard: TelegramKeyboard;
} {
  const keyboard: TelegramKeyboard = [
    [{ text: '📦 ออเดอร์ร้านนี้', callback_data: `s:${shop.shop_id}:orders` }],
  ];
  if (shop.role === 'owner' || shop.role === 'superadmin') {
    keyboard.push([{ text: '🟢 เปิด / 🔴 ปิดร้าน', callback_data: `s:${shop.shop_id}:toggle` }]);
  }
  const kds = miniAppButton('🧑‍🍳 เปิด KDS', 'kds', shop.shop_id);
  if (kds) keyboard.push([kds]);
  const settings = miniAppButton('⚙️ ตั้งค่าร้าน', 'settings', shop.shop_id);
  if (settings) keyboard.push([settings]);
  keyboard.push([{ text: '◀️ กลับเมนูหลัก', callback_data: 'm:menu' }]);
  return { text: `🏪 *${shop.shop_name}*`, keyboard };
}

/** Static help text (no role data inside). */
export const HELP_TEXT =
  `❓ *ช่วยเหลือ*\n\n` +
  `• /menu — เปิดเมนูตามสิทธิ์\n` +
  `• /account — ดูตัวตนและสิทธิ์ที่ยืนยันแล้ว\n` +
  `• /unlink — ยกเลิกการผูก Telegram นี้\n` +
  `• งานซับซ้อน (KDS, ตั้งค่า, แผนที่, Settlement) เปิดผ่านปุ่ม Mini App\n` +
  `• มีปัญหา ติดต่อผู้ดูแลร้านของคุณ`;

export const VERIFY_PROMPT_TEXT =
  `🔐 *กรุณายืนยันตัวตนก่อน*\n\n` +
  `บอทนี้ให้บริการเฉพาะผู้ใช้ที่ยืนยันแล้ว\n` +
  `1. เข้าสู่ระบบที่หน้าเว็บ RAN-R-HAN\n` +
  `2. เปิด "บัญชีของฉัน" → "เชื่อม Telegram"\n` +
  `3. กดลิงก์ที่ได้ แล้วกลับมากดยืนยันที่หน้าเว็บ`;
