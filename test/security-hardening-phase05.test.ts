import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

/**
 * ตัดคอมเมนต์ออกก่อนตรวจ
 *
 * เทสชุดนี้ตรวจว่ารูปแบบอันตรายไม่มีอยู่ในโค้ดแล้ว แต่คอมเมนต์ที่อธิบายว่า
 * "เมื่อก่อนเคยเขียนแบบนี้" มีข้อความเดียวกัน ถ้าไม่ตัดออกก่อนจะแดงจากคอมเมนต์
 * ของตัวเอง ไม่ใช่จากโค้ดจริง
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

function stripTsComments(ts: string): string {
  return ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * ตัดฟังก์ชันหนึ่งตัวออกมาจากซอร์ส โดยจบที่ export ถัดไป
 * ใช้ตรวจลำดับการตรวจสิทธิ์ภายในฟังก์ชันนั้นโดยไม่ปนกับฟังก์ชันอื่น
 */
function extractFn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  assert.ok(start !== -1, `ไม่พบฟังก์ชัน ${name}`);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next !== -1 ? next : undefined);
}

describe('RLS: ข้อมูลลูกค้าต้องไม่เปิดให้ anon อ่าน', () => {
  const migration = source('supabase/migrations/20260914000006_tighten_customer_data_rls.sql');

  it('ลบ policy เดิมที่มี or true ของทั้งสามตาราง', () => {
    for (const policy of [
      'Orders viewable by customer and staff',
      'Order items viewable by order owner and staff',
      'Payments viewable by customer and staff',
    ]) {
      assert.ok(
        migration.includes(`drop policy if exists "${policy}"`),
        `ต้อง drop policy เดิม "${policy}"`
      );
    }
  });

  it('policy ใหม่ต้องไม่มี or true หลงเหลือ', () => {
    assert.ok(
      !/or\s+true/i.test(stripSqlComments(migration)),
      'migration ที่ตั้งใจปิดรู ห้ามมี or true อยู่ในตัวเอง'
    );
  });

  it('policy ใหม่ทั้งสามตัวผูกกับ has_shop_access', () => {
    for (const policy of [
      'Orders viewable by shop staff',
      'Order items viewable by shop staff',
      'Payments viewable by shop staff',
    ]) {
      const idx = migration.indexOf(`create policy "${policy}"`);
      assert.ok(idx !== -1, `ไม่พบ policy ใหม่ "${policy}"`);
      const body = migration.slice(idx, idx + 500);
      assert.match(body, /has_shop_access/, `${policy} ต้องตรวจ has_shop_access`);
    }
  });

  it('ลงทะเบียนใน run-db.js แล้ว ไม่งั้นฐานข้อมูลที่สร้างใหม่จะไม่ถูกปิดรู', () => {
    assert.match(
      source('scripts/run-db.js'),
      /20260914000006_tighten_customer_data_rls\.sql/,
      'migration ต้องถูกลงทะเบียนใน scripts/run-db.js'
    );
  });
});

describe('หน้าติดตามออเดอร์ต้องไม่พึ่ง anon realtime อีก', () => {
  const tracker = source('src/app/order/[orderId]/OrderTrackerClient.tsx');

  it('ไม่ subscribe postgres_changes ด้วย browser client แล้ว', () => {
    const code = stripTsComments(tracker);
    assert.ok(
      !code.includes('postgres_changes'),
      'หน้า tracker ห้าม subscribe postgres_changes เพราะต้องเปิด RLS ให้ anon'
    );
    assert.ok(
      !code.includes('@/lib/supabase/client'),
      'หน้า tracker ห้าม import browser supabase client'
    );
  });

  it('เรียก server action สำหรับสถานะแทน', () => {
    assert.match(tracker, /getOrderTrackingSnapshotAction/);
  });

  it('server action คืนเฉพาะฟิลด์สถานะ ไม่คืนข้อมูลส่วนตัวลูกค้า', () => {
    const fn = extractFn(source('src/app/actions/order.ts'), 'getOrderTrackingSnapshotAction');
    for (const leak of ['customer_name', 'customer_phone', 'delivery_address']) {
      assert.ok(!fn.includes(leak), `getOrderTrackingSnapshotAction ห้ามคืน ${leak}`);
    }
    assert.match(fn, /\.select\('status'\)/, 'ต้องเลือกเฉพาะคอลัมน์ status จาก orders');
  });
});

describe('Server action ที่ใช้ admin client ต้องตรวจสิทธิ์ก่อน', () => {
  it('updateShopTelegramSettingsAction ตรวจ has_shop_access ก่อนแตะ admin client', () => {
    const fn = extractFn(source('src/app/actions/telegram.ts'), 'updateShopTelegramSettingsAction');
    const accessIdx = fn.indexOf('has_shop_access');
    const adminIdx = fn.indexOf('createAdminClient()');

    assert.ok(accessIdx !== -1, 'ต้องเรียก has_shop_access');
    assert.ok(adminIdx !== -1, 'ต้องเรียก createAdminClient()');
    assert.ok(
      accessIdx < adminIdx,
      'has_shop_access ต้องถูกตรวจก่อน createAdminClient()'
    );
    assert.match(
      fn.slice(accessIdx, adminIdx),
      /if\s*\(\s*!hasAccess\s*\)\s*\{\s*return\b/,
      'ต้อง return ทันทีเมื่อไม่มีสิทธิ์ ก่อนถึง admin client'
    );
  });

  it('updateShopTelegramSettingsAction ไม่คืน error ดิบจากฐานข้อมูล', () => {
    const fn = extractFn(source('src/app/actions/telegram.ts'), 'updateShopTelegramSettingsAction');
    assert.ok(
      !/error:\s*error\.message/.test(fn),
      'ต้องแปลเป็นข้อความไทยคงที่ก่อนส่งกลับ client'
    );
  });

  it('impersonateStoreAction ตรวจ superadmin ก่อนตั้ง cookie', () => {
    const fn = extractFn(source('src/app/actions/superadmin.ts'), 'impersonateStoreAction');
    const checkIdx = fn.indexOf('checkIsSuperadmin()');
    const setIdx = fn.indexOf('cookieStore.set');
    assert.ok(checkIdx !== -1, 'ต้องเรียก checkIsSuperadmin()');
    assert.ok(checkIdx < setIdx, 'ต้องตรวจสิทธิ์ก่อนตั้ง cookie สวมรอย');
  });
});

describe('ตรรกะ cron ต้องไม่อยู่ในไฟล์ use server', () => {
  it('dispatch.ts ไม่ export timeoutOfferAction แล้ว', () => {
    const dispatch = source('src/app/actions/dispatch.ts');
    assert.ok(dispatch.startsWith("'use server'"), 'สมมติฐานของเทสนี้คือไฟล์เป็น use server');
    assert.ok(
      !/export async function timeoutOfferAction/.test(stripTsComments(dispatch)),
      'ทุก export ในไฟล์ use server เป็น endpoint สาธารณะ ฟังก์ชันนี้ไม่มีการตรวจสิทธิ์'
    );
  });

  it('ย้ายไปอยู่ใน lib ที่ไม่ใช่ use server', () => {
    const libPath = 'src/lib/dispatch-timeout.ts';
    assert.ok(existsSync(resolve(root, libPath)), `ต้องมี ${libPath}`);
    const lib = source(libPath);
    assert.ok(
      !stripTsComments(lib).includes("'use server'"),
      'lib นี้ห้ามเป็น use server'
    );
    assert.match(lib, /expire_dispatch_offers/, 'ต้องยังเรียก RPC เดิม');
  });

  it('cron route เรียกตัวใหม่และยังตรวจ CRON_SECRET', () => {
    const route = source('src/app/api/cron/dispatch-timeout/route.ts');
    assert.match(route, /expireDispatchOffers/);
    assert.ok(!route.includes('timeoutOfferAction'), 'ต้องไม่อ้างชื่อเดิมแล้ว');
    assert.match(route, /CRON_SECRET/);
  });
});

describe('SlipOK: ห้ามยิง API key และสลิปลูกค้าไปโดเมนอื่น', () => {
  const payment = source('src/app/actions/payment.ts');

  it('ตรวจ hostname และ protocol ก่อน fetch', () => {
    const idx = payment.indexOf('let targetUrl');
    assert.ok(idx !== -1, 'ไม่พบการประกอบ targetUrl');
    const block = payment.slice(idx, payment.indexOf('slipResponse = await fetch'));
    assert.match(block, /hostname\s*!==\s*SLIPOK_HOST|hostname\s*!==\s*'api\.slipok\.com'/);
    assert.match(block, /protocol\s*!==\s*'https:'/);
  });

  it('ไม่รับ URL ดิบที่ขึ้นต้นด้วย http:// เข้ามาเป็น targetUrl ตรง ๆ', () => {
    assert.ok(
      !/targetUrl = rawUrl;/.test(payment),
      'ห้ามกำหนด targetUrl จากค่าในฐานข้อมูลโดยไม่ตรวจโดเมน'
    );
  });
});

describe('Telegram webhook ต้อง fail-closed', () => {
  const route = source('src/app/api/telegram/webhook/route.ts');

  it('ตรวจ x-telegram-bot-api-secret-token', () => {
    assert.match(route, /x-telegram-bot-api-secret-token/);
    assert.match(route, /TELEGRAM_WEBHOOK_SECRET/);
  });

  it('ไม่ตั้ง secret = ปฏิเสธ ไม่ใช่ปล่อยผ่าน', () => {
    const idx = route.indexOf('TELEGRAM_WEBHOOK_SECRET');
    const block = route.slice(idx, idx + 600);
    assert.match(block, /status:\s*500/, 'ไม่มี config ต้องตอบ 500 ไม่ใช่ทำงานต่อ');
    assert.match(block, /status:\s*401/, 'secret ไม่ตรงต้องตอบ 401');
  });
});
