import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// Minimal in-memory supabase-admin mock: from(table) -> chainable query.
function mockAdmin(fixtures: Record<string, any[]>) {
  const state = { table: '', filters: [] as Array<(row: any) => boolean> };
  const api: any = {};
  const match = () => (fixtures[state.table] ?? []).filter((r) => state.filters.every((f) => f(r)));
  api.from = (table: string) => {
    state.table = table;
    state.filters = [];
    return api;
  };
  api.select = () => api;
  api.eq = (col: string, val: unknown) => {
    state.filters.push((r) => String(r[col]) === String(val));
    return api;
  };
  api.is = (col: string, val: unknown) => {
    state.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
    return api;
  };
  api.in = (col: string, vals: unknown[]) => {
    const set = new Set(vals.map(String));
    state.filters.push((r) => set.has(String(r[col])));
    return api;
  };
  api.order = () => api;
  api.limit = () => api;
  api.maybeSingle = async () => ({ data: match()[0] ?? null, error: null });
  api.single = async () => {
    const row = match()[0] ?? null;
    return row ? { data: row, error: null } : { data: null, error: { message: 'none' } };
  };
  api.insert = async (rows: any) => ({ data: rows, error: null });
  api.update = async () => ({ data: null, error: null });
  api.upsert = async () => ({ data: null, error: null });
  api.delete = async () => ({ data: null, error: null });
  const terminal = async () => ({ data: match(), error: null });
  api.then = (res: any, rej: any) => terminal().then(res, rej);
  return api;
}

const baseFixtures = (): Record<string, any[]> => ({
  telegram_identities: [
    { telegram_user_id: 111, user_id: 'u-multi', verified_at: '2026-09-14T00:00:00Z', revoked_at: null },
    { telegram_user_id: 222, user_id: 'u-revoked', verified_at: '2026-09-14T00:00:00Z', revoked_at: '2026-09-14T01:00:00Z' },
  ],
  users: [
    { id: 'u-multi', shop_id: 'shop-a', role: 'owner', full_name: 'Multi', phone: '0812345678' },
    { id: 'u-rider', shop_id: null, role: 'staff', full_name: 'Rider', phone: null },
    { id: 'u-revoked', shop_id: 'shop-a', role: 'staff', full_name: 'Gone', phone: null },
    { id: 'u-admin', shop_id: null, role: 'superadmin', full_name: 'Root', phone: null },
  ],
  shop_members: [
    { user_id: 'u-multi', shop_id: 'shop-b', role: 'staff', is_active: true },
    { user_id: 'u-multi', shop_id: 'shop-c', role: 'owner', is_active: false },
  ],
  shops: [
    { id: 'shop-a', name: 'ร้านเอ' },
    { id: 'shop-b', name: 'ร้านบี' },
  ],
  riders: [
    { id: 'rider-1', shop_id: 'shop-a', display_name: 'ไรเดอร์หนึ่ง', auth_user_id: 'u-rider', phone: '0899999999' },
    { id: 'rider-9', shop_id: 'shop-b', display_name: 'ไรเดอร์เก้า', auth_user_id: 'someone-else', phone: '0888888888' },
  ],
  orders: [],
  dispatch_offers: [],
  rider_work_sessions: [],
  rider_current_locations: [],
  daily_settlements: [],
  push_subscriptions: [],
});

describe('Gateway identity: unverified and revoked accounts resolve to nothing', () => {
  it('unknown telegram account resolves to null (unverified /start path)', async () => {
    const { resolveTelegramIdentity } = await import('../src/lib/telegram-identity');
    const admin = mockAdmin(baseFixtures());
    assert.equal(await resolveTelegramIdentity(admin, 999999), null);
  });

  it('revoked account resolves to null', async () => {
    const { resolveTelegramIdentity } = await import('../src/lib/telegram-identity');
    const admin = mockAdmin(baseFixtures());
    assert.equal(await resolveTelegramIdentity(admin, 222), null);
  });

  it('non-numeric identity input resolves to null', async () => {
    const { resolveTelegramIdentity } = await import('../src/lib/telegram-identity');
    const admin = mockAdmin(baseFixtures());
    assert.equal(await resolveTelegramIdentity(admin, 'not-a-number'), null);
  });
});

describe('Gateway identity: multi-role and multi-shop resolution', () => {
  it('one account resolves shops from users row plus active members only', async () => {
    const { resolveTelegramIdentity } = await import('../src/lib/telegram-identity');
    const admin = mockAdmin(baseFixtures());
    const id = await resolveTelegramIdentity(admin, 111);
    assert.ok(id);
    assert.equal(id.user_id, 'u-multi');
    const shopIds = id.shops.map((s) => s.shop_id).sort();
    assert.deepEqual(shopIds, ['shop-a', 'shop-b']);
    assert.ok(!shopIds.includes('shop-c'), 'inactive membership must not resolve');
  });

  it('rider rows resolve only through riders.auth_user_id', async () => {
    const { resolveTelegramIdentity, ownsRider, memberOfShop } = await import(
      '../src/lib/telegram-identity'
    );
    const admin = mockAdmin({
      ...baseFixtures(),
      telegram_identities: [
        { telegram_user_id: 333, user_id: 'u-rider', verified_at: '2026-09-14T00:00:00Z', revoked_at: null },
      ],
    });
    const id = await resolveTelegramIdentity(admin, 333);
    assert.ok(id);
    assert.deepEqual(id.riders.map((r) => r.rider_id), ['rider-1']);
    assert.equal(ownsRider(id, 'rider-1'), true);
    assert.equal(ownsRider(id, 'rider-9'), false);
    assert.equal(memberOfShop(id, 'shop-a'), false);
  });

  it('superadmin passes shop scope without holding the shop', async () => {
    const { memberOfShop } = await import('../src/lib/telegram-identity');
    assert.equal(
      memberOfShop(
        {
          telegram_user_id: 1, user_id: 'u-admin', role: 'superadmin', is_superadmin: true,
          verified_at: '', shops: [], riders: [],
        },
        'any-shop'
      ),
      true
    );
  });
});

describe('Role menu: buttons follow the verified roles only', () => {
  it('multi-shop identity gets a shop picker, single-shop gets direct home', async () => {
    const { buildMainMenu, buildShopPicker } = await import('../src/lib/telegram-menu');
    const { resolveTelegramIdentity } = await import('../src/lib/telegram-identity');
    const admin = mockAdmin(baseFixtures());
    const id = await resolveTelegramIdentity(admin, 111);
    assert.ok(id);
    const menu = buildMainMenu(id);
    assert.match(JSON.stringify(menu.keyboard), /m:shop/);
    assert.doesNotMatch(JSON.stringify(menu.keyboard), /s:list/);
    const { buildShopMenu } = await import('../src/lib/telegram-menu');
    const sub = JSON.stringify(buildShopMenu(id).keyboard);
    assert.match(sub, /s:list/);
    assert.match(sub, /o:mine/);
    assert.match(sub, /st:menu/);
    const picker = buildShopPicker(id.shops);
    assert.equal(picker.keyboard.length, 2);
  });

  it('rider-only identity sees rider menu but no shop menu', async () => {
    const { buildMainMenu } = await import('../src/lib/telegram-menu');
    const { resolveTelegramIdentity } = await import('../src/lib/telegram-identity');
    const admin = mockAdmin({
      ...baseFixtures(),
      telegram_identities: [
        { telegram_user_id: 333, user_id: 'u-rider', verified_at: '2026-09-14T00:00:00Z', revoked_at: null },
      ],
    });
    const id = await resolveTelegramIdentity(admin, 333);
    assert.ok(id);
    const dump = JSON.stringify(buildMainMenu(id).keyboard);
    assert.match(dump, /m:rider/);
    assert.doesNotMatch(dump, /s:list|🏪 ร้านค้า/);
    const { buildRiderMenu } = await import('../src/lib/telegram-menu');
    const sub = JSON.stringify(buildRiderMenu().keyboard);
    assert.match(sub, /r:offers/);
    assert.match(sub, /r:summary/);
    assert.doesNotMatch(sub, /r:status/);
  });

  it('identity without roles sees only account and help', async () => {
    const { buildMainMenu } = await import('../src/lib/telegram-menu');
    const menu = buildMainMenu({
      telegram_user_id: 1, user_id: 'u', role: 'staff', is_superadmin: false,
      verified_at: '', shops: [], riders: [],
    });
    const dump = JSON.stringify(menu.keyboard);
    assert.match(dump, /m:acct/);
    assert.match(dump, /m:help/);
    assert.doesNotMatch(dump, /o:mine|r:status|st:menu|map:menu/);
  });

  it('mini app buttons are omitted when the app URL is not configured', async () => {
    const { miniAppButton } = await import('../src/lib/telegram-menu');
    const saved = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      assert.equal(miniAppButton('KDS', 'kds', 'shop-a'), null);
    } finally {
      if (saved !== undefined) process.env.NEXT_PUBLIC_APP_URL = saved;
    }
  });
});

describe('Queries: empty states and PII minimization', () => {
  it('no active order answers that there is none', async () => {
    const { myOrdersText } = await import('../src/lib/telegram-queries');
    const admin = mockAdmin(baseFixtures());
    const text = await myOrdersText(admin, {
      telegram_user_id: 111, user_id: 'u-multi', role: 'owner', is_superadmin: false,
      verified_at: '', shops: [{ shop_id: 'shop-a', shop_name: 'ร้านเอ', role: 'owner', source: 'users' }], riders: [],
    });
    assert.match(text, /ไม่มี active order/);
  });

  it('account and job texts never leak phone, address, or customer fields', async () => {
    const { accountText, riderJobsText } = await import('../src/lib/telegram-queries');
    const pii = {
      telegram_user_id: 111, user_id: 'u-multi', role: 'owner', is_superadmin: false,
      verified_at: '', shops: [{ shop_id: 'shop-a', shop_name: 'ร้านเอ', role: 'owner', source: 'users' as const }],
      riders: [{ rider_id: 'rider-1', shop_id: 'shop-a', shop_name: 'ร้านเอ', display_name: 'ไรเดอร์หนึ่ง' }],
    };
    const admin = mockAdmin({
      ...baseFixtures(),
      dispatch_offers: [
        {
          id: 'offer-1', order_id: 'order-1', status: 'offered', timeout_at: null,
          rider_id: 'rider-1', orders: { order_no: '7' },
        },
      ],
      orders: [{
        order_no: '7', dispatch_status: 'assigned', assigned_rider_id: 'rider-1', shop_id: 'shop-a',
        customer_phone: '0812345678', delivery_address: '99 ถนนลับ', customer_name: 'ลูกค้าลับ',
      }],
    });
    const combined = accountText(pii) + '\n' + (await riderJobsText(admin, pii));
    assert.doesNotMatch(combined, /0812345678|0899999999|0888888888/);
    assert.doesNotMatch(combined, /ถนนลับ|ลูกค้าลับ/);
    assert.doesNotMatch(combined, /delivery_address|customer_name|customer_phone|phone/i);
  });
});

describe('Markdown safety: dynamic values never break Telegram parsing', () => {
  it('escapes legacy-Markdown metacharacters', async () => {
    const { escapeTelegramMarkdown } = await import('../src/lib/telegram');
    assert.equal(escapeTelegramMarkdown('in_transit'), 'in\\_transit');
    assert.equal(escapeTelegramMarkdown('a*b`c[d]e\\f'), 'a\\*b\\`c\\[d\\]e\\\\f');
    assert.equal(escapeTelegramMarkdown(null), '');
  });

  it('in_transit dispatch status survives Telegram parsing', async () => {
    const { riderJobsText } = await import('../src/lib/telegram-queries');
    const admin = mockAdmin({
      ...baseFixtures(),
      orders: [{
        order_no: 'TG9001', dispatch_status: 'in_transit', assigned_rider_id: 'rider-1',
        shop_id: 'shop-a',
      }],
    });
    const text = await riderJobsText(admin, {
      telegram_user_id: 333, user_id: 'u-rider', role: 'staff', is_superadmin: false,
      verified_at: '',
      shops: [], riders: [{ rider_id: 'rider-1', shop_id: 'shop-a', shop_name: 'ร้านเอ', display_name: 'ไรเดอร์หนึ่ง' }],
    });
    assert.match(text, /in\\_transit/);
    assert.doesNotMatch(text, /[^\\]_transit/);
  });

  it('every mini app target resolves to a real route', async () => {
    const { MINI_APP_PATHS } = await import('../src/lib/telegram-menu');
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const [key, path] of Object.entries(MINI_APP_PATHS)) {
      const page = resolve(root, 'src/app', `.${path}`, 'page.tsx');
      assert.ok(existsSync(page), `mini app ${key} must map to an existing page (got ${path})`);
    }
  });

  it('underscore shop names are escaped in picker and home', async () => {
    const { buildShopPicker, buildShopHome } = await import('../src/lib/telegram-menu');
    const shops = [{ shop_id: 's1', shop_name: 'Shop_A', role: 'owner', source: 'users' as const }];
    assert.equal(buildShopPicker(shops).keyboard[0][0].text, 'Shop\\_A (owner)');
    assert.match(buildShopHome(shops[0]).text, /Shop\\_A/);
  });
});

describe('Routing: verified holders only, never raw chat ids', () => {
  it('shop routing reaches holders and excludes blanket superadmin', async () => {
    const { getVerifiedChatsForShop } = await import('../src/lib/telegram-routing');
    const admin = mockAdmin({
      ...baseFixtures(),
      telegram_identities: [
        { telegram_user_id: 111, user_id: 'u-multi', verified_at: '', revoked_at: null },
        { telegram_user_id: 444, user_id: 'u-admin', verified_at: '', revoked_at: null },
      ],
    });
    const chats = await getVerifiedChatsForShop(admin, 'shop-a');
    assert.deepEqual(chats, [111]);
  });

  it('capacity rejection surfaces the 2-job limit message', () => {
    const code = stripTs(source('src/app/api/telegram/webhook/route.ts'));
    assert.match(code, /RIDER_CAPACITY_REACHED/);
    assert.match(code, /เกิน 2 งาน/);
  });

  it('offer buttons exclude expired offers like the text does', () => {
    const code = stripTs(source('src/app/api/telegram/webhook/route.ts'));
    const start = code.indexOf("data === 'r:offers'");
    const block = code.slice(start, code.indexOf('offerMatch', start));
    assert.match(block, /timeout_at/);
    assert.match(block, /new Date\(o\.timeout_at\) > new Date\(\)/);
  });

  it('offer routing resolves through riders.auth_user_id only', async () => {
    const { getVerifiedChatForRider } = await import('../src/lib/telegram-routing');
    const admin = mockAdmin({
      ...baseFixtures(),
      telegram_identities: [
        { telegram_user_id: 333, user_id: 'u-rider', verified_at: '', revoked_at: null },
      ],
    });
    assert.equal(await getVerifiedChatForRider(admin, 'rider-1'), 333);
    assert.equal(await getVerifiedChatForRider(admin, 'no-such-rider'), null);
  });

  it('rider without auth_user_id never routes', async () => {
    const { getVerifiedChatForRider } = await import('../src/lib/telegram-routing');
    const admin = mockAdmin({
      ...baseFixtures(),
      riders: [{ id: 'rider-x', shop_id: 'shop-a', display_name: 'X', auth_user_id: null }],
    });
    assert.equal(await getVerifiedChatForRider(admin, 'rider-x'), null);
  });

  it('resolution failures fail closed instead of throwing', async () => {
    const {
      getVerifiedChatForRider,
      getVerifiedChatForUser,
      getVerifiedChatsForShop,
    } = await import('../src/lib/telegram-routing');
    const broken = { from: () => ({ select: () => ({}) }) };
    assert.equal(await getVerifiedChatForRider(broken, 'rider-1'), null);
    assert.equal(await getVerifiedChatForUser(broken, 'u'), null);
    assert.deepEqual(await getVerifiedChatsForShop(broken, 'shop-a'), []);
  });
});

describe('Verify-token contract: single use, expiry, ownership', () => {
  it('confirm action enforces ownership, single use, and expiry before binding', () => {
    const code = stripTs(source('src/app/actions/telegram-identity.ts'));
    assert.match(code, /row\.user_id !== user\.id/);
    assert.match(code, /row\.used/);
    assert.match(code, /new Date\(row\.expires_at\) < new Date\(\)/);
    assert.match(code, /!row\.telegram_user_id/);
    assert.match(code, /update\(\{ used: true \}\)/);
  });

  it('verify tokens expire in 10 minutes and default to unused', () => {
    const sql = source('supabase/migrations/20260914000012_telegram_identity_members.sql');
    assert.match(sql, /now\(\) \+ interval '10 minutes'/);
    assert.match(sql, /used boolean not null default false/);
  });

  it('one active telegram link per user is enforced', () => {
    const sql = source('supabase/migrations/20260914000012_telegram_identity_members.sql');
    assert.match(sql, /uq_telegram_identities_active_user/);
    const code = stripTs(source('src/app/actions/telegram-identity.ts'));
    assert.match(code, /ผูก Telegram อื่นไว้แล้ว/);
  });
});

describe('Callback guards: ownership is re-verified on every mutation', () => {
  it('offer callbacks check rider ownership then delegate to the core RPC', () => {
    const code = stripTs(source('src/app/api/telegram/webhook/route.ts'));
    assert.match(code, /ownsRider\(identity, String\(offer\.rider_id\)\)/);
    assert.match(code, /telegram_offer_respond/);
    assert.match(code, /งานนี้ไม่ใช่ของคุณ/);
  });

  it('shop toggle checks membership and owner role before the RPC', () => {
    const code = stripTs(source('src/app/api/telegram/webhook/route.ts'));
    assert.match(code, /memberOfShop\(identity, shopId\)/);
    assert.match(code, /เฉพาะเจ้าของร้าน/);
    assert.match(code, /telegram_shop_set_open/);
  });

  it('settlement and map menus re-check scope, superadmin gates stay in route', () => {
    const code = stripTs(source('src/app/api/telegram/webhook/route.ts'));
    assert.match(code, /memberOfShop\(identity, shopId\)/);
    assert.match(code, /!identity\.is_superadmin/);
  });

  it('actor wrappers fail closed and delegate instead of duplicating logic', () => {
    const sql = source('supabase/migrations/20260914000013_telegram_actor_actions.sql');
    assert.match(sql, /FORBIDDEN_OFFER/);
    assert.match(sql, /FORBIDDEN_SHOP/);
    assert.match(sql, /respond_to_dispatch_offer\(p_offer_id, p_action\)/);
    assert.match(sql, /set_shop_open_status\(p_shop_id, p_is_open\)/);
    assert.match(sql, /grant execute[\s\S]*to service_role/);
    assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  });
});

describe('Webhook and setup hygiene', () => {
  it('webhook still enforces the secret header and keeps the order-link flow', () => {
    const code = stripTs(source('src/app/api/telegram/webhook/route.ts'));
    assert.match(code, /x-telegram-bot-api-secret-token/);
    assert.match(code, /status: 401/);
    assert.match(code, /telegram_link_tokens/);
    assert.match(code, /15 นาที/);
  });

  it('setup script reads secrets from env and registers secret_token', () => {
    const code = stripTs(source('scripts/setup-telegram-bot.js'));
    assert.match(code, /process\.env\.TELEGRAM_BOT_TOKEN/);
    assert.match(code, /process\.env\.TELEGRAM_WEBHOOK_SECRET/);
    assert.match(code, /secret_token: webhookSecret/);
    assert.doesNotMatch(code, /const token = '[0-9]+:/);
    assert.doesNotMatch(code, /[0-9]{8,10}:[A-Za-z0-9_-]{30,}/);
  });

  it('no bot token or secret is logged by the gateway libs', () => {
    for (const f of [
      'src/lib/telegram.ts',
      'src/lib/telegram-routing.ts',
      'src/lib/telegram-identity.ts',
      'src/app/api/telegram/webhook/route.ts',
    ]) {
      const code = stripTs(source(f));
      assert.doesNotMatch(code, /console\.(log|error)\([^)]*token[^)]*\)/i);
    }
  });

  it('offer message drops the hardcoded fallback URL', () => {
    const code = stripTs(source('src/lib/rider-notification.ts'));
    assert.doesNotMatch(code, /ran-r-han\.vercel\.app/);
    assert.match(code, /getVerifiedChatForRider/);
  });
});
