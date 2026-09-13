import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatThaiError } from '../src/lib/thai-errors';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Authorization regression: RPC-level auth guards', () => {
  const migration = source('supabase/migrations/20260912000006_service_area_enforcement.sql');

  it('rejects unauthenticated callers (auth.uid() is null)', () => {
    // Every user-facing security-definer RPC must check auth.uid() is null
    // close_rider_work_session_internal is an internal primitive (not directly callable)
    const rpcs = [
      'set_shop_service_area_settings',
      'start_rider_work_session',
      'report_rider_location',
      'close_rider_work_session(?!_internal)',
      'update_shop_geo',
    ];

    for (const rpc of rpcs) {
      const fnMatch = migration.match(
        new RegExp(`create or replace function public\\.${rpc}\\b[\\s\\S]*?end;\\s*\\$\\$`, 'i')
      );
      assert.ok(fnMatch, `RPC ${rpc} not found in migration`);
      assert.match(
        fnMatch![0],
        /auth\.uid\(\) is null/i,
        `RPC ${rpc} must reject unauthenticated callers`
      );
    }
  });

  it('enforces shop access for settings and geo updates (has_shop_access)', () => {
    for (const rpc of ['set_shop_service_area_settings', 'update_shop_geo']) {
      const fnMatch = migration.match(
        new RegExp(`create or replace function public\\.${rpc}[\\s\\S]*?end;\\s*\\$\\$`, 'i')
      );
      assert.ok(fnMatch, `RPC ${rpc} not found`);
      assert.match(
        fnMatch![0],
        /has_shop_access\(p_shop_id\)/i,
        `RPC ${rpc} must call has_shop_access(p_shop_id)`
      );
    }
  });

  it('rider RPCs verify shop_id binding so user A cannot affect shop B riders', () => {
    for (const rpc of ['start_rider_work_session', 'report_rider_location']) {
      const fnMatch = migration.match(
        new RegExp(`create or replace function public\\.${rpc}[\\s\\S]*?end;\\s*\\$\\$`, 'i')
      );
      assert.ok(fnMatch, `RPC ${rpc} not found`);
      assert.match(
        fnMatch![0],
        /auth_user_id = auth\.uid\(\)[^]*?shop_id = p_shop_id/i,
        `RPC ${rpc} must bind rider lookup to both auth.uid() and shop_id`
      );
    }
  });

  it('superadmin-only sweep is restricted to service_role', () => {
    assert.match(
      migration,
      /revoke all on function public\.sweep_expired_rider_geofence_sessions\(\)[^]*?from public, anon, authenticated/i
    );
    assert.match(
      migration,
      /grant execute on function public\.sweep_expired_rider_geofence_sessions\(\)[^]*?to service_role/i
    );
  });

  it('close_rider_work_session only closes sessions owned by auth.uid()', () => {
    const fnMatch = migration.match(
      /create or replace function public\.close_rider_work_session\([^)]*\)[\s\S]*?end;\s*\$\$/i
    );
    assert.ok(fnMatch, 'close_rider_work_session not found');
    assert.match(
      fnMatch![0],
      /r\.auth_user_id = auth\.uid\(\)/i,
      'Must verify rider ownership via auth.uid()'
    );
  });

  it('profile query failure results in denial (fail-closed)', () => {
    // update_shop_geo delegates auth entirely to the RPC (has_shop_access).
    // If the RPC cannot resolve the profile, it raises SHOP_ACCESS_DENIED.
    const fnMatch = migration.match(
      /create or replace function public\.update_shop_geo[\s\S]*?end;\s*\$\$/i
    );
    assert.ok(fnMatch, 'update_shop_geo not found');
    // The first thing after null-check is has_shop_access — if it returns false
    // for any reason (missing profile, wrong shop), we get SHOP_ACCESS_DENIED
    assert.match(
      fnMatch![0],
      /auth\.uid\(\) is null or not public\.has_shop_access\(p_shop_id\)[\s\S]*?SHOP_ACCESS_DENIED/i
    );
  });

  it('does not send admin-client updates when authorization fails', () => {
    // updateShopGeoAction should use session-bound client (createClient),
    // NOT createAdminClient, for the geo update RPC call
    const settingsAction = source('src/app/actions/settings.ts');
    // Extract the function body between its declaration and the next export
    const geoStart = settingsAction.indexOf('export async function updateShopGeoAction');
    assert.ok(geoStart !== -1, 'updateShopGeoAction not found');
    const nextExport = settingsAction.indexOf('\nexport ', geoStart + 1);
    const geoFn = settingsAction.slice(geoStart, nextExport !== -1 ? nextExport : undefined);
    // Must NOT use admin client for the geo RPC
    assert.ok(
      !geoFn.includes('createAdminClient'),
      'updateShopGeoAction must not use admin client for geo updates'
    );
    // Must use session-bound client
    assert.ok(
      geoFn.includes('await createClient()'),
      'updateShopGeoAction must use session-bound client'
    );
  });

  it('revokes direct writes that would bypass service-area RPC locks', () => {
    assert.match(
      migration,
      /revoke update on table public\.shops from anon, authenticated/i,
      'shop boundary fields must only be changed through server-authorized RPCs'
    );
    assert.match(
      migration,
      /revoke insert, update, delete on table public\.rider_current_locations\s+from anon, authenticated/i,
      'rider locations must only be written through report_rider_location'
    );
    assert.match(
      migration,
      /drop policy if exists "Rider can upsert own location"\s+on public\.rider_current_locations/i
    );
  });
});

describe('Authorization regression: API route guards', () => {
  it('rider location API rejects unauthenticated requests', () => {
    const route = source('src/app/api/rider/location/route.ts');
    assert.match(route, /authError \|\| !user[\s\S]*?status: 401/i);
  });

  it('rider session start API rejects unauthenticated requests', () => {
    const route = source('src/app/api/rider/session/start/route.ts');
    assert.match(route, /authError \|\| !user[\s\S]*?status: 401/i);
  });

  it('service area settings action rejects unauthenticated requests', () => {
    const action = source('src/app/actions/settings.ts');
    assert.match(
      action,
      /updateServiceAreaSettingsAction[\s\S]*?userError \|\| !user[\s\S]*?กรุณาเข้าสู่ระบบ/i
    );
  });

  it('geo update action rejects unauthenticated requests', () => {
    const action = source('src/app/actions/settings.ts');
    assert.match(
      action,
      /updateShopGeoAction[\s\S]*?userError \|\| !user[\s\S]*?กรุณาเข้าสู่ระบบ/i
    );
  });
});

describe('Error leakage prevention', () => {
  it('maps unknown database errors to a fixed safe message', () => {
    const raw = 'duplicate key violates secret_internal_constraint';
    assert.equal(
      formatThaiError({ message: raw }),
      'เกิดข้อผิดพลาดในการทำรายการ กรุณาลองใหม่อีกครั้ง'
    );
  });

  it('settings.ts never returns raw error.message to client', () => {
    const settings = source('src/app/actions/settings.ts');
    // All error returns should use formatThaiError, not raw .message
    assert.doesNotMatch(
      settings,
      /return \{ success: false, error: (?:error|err)\.message/,
      'Must not leak raw database error messages to client'
    );
  });

  it('rider location API does not expose raw RPC errors', () => {
    const route = source('src/app/api/rider/location/route.ts');
    assert.doesNotMatch(
      route,
      /NextResponse\.json\(\{ error: rpcError\.message/,
      'Must not leak raw RPC error to client'
    );
  });

  it('rider session start API does not expose raw RPC errors', () => {
    const route = source('src/app/api/rider/session/start/route.ts');
    assert.doesNotMatch(
      route,
      /NextResponse\.json\(\{ error: rpcError\.message/,
      'Must not leak raw RPC error to client'
    );
  });

  it('geofence sweep API does not expose database errors', () => {
    const route = source('src/app/api/cron/rider-geofence-sweep/route.ts');
    assert.doesNotMatch(
      route,
      /NextResponse\.json\(\{ success: false, error: (?:error|err)\.message/,
      'Must not leak raw error to client'
    );
  });
});

describe('Tenant-scoped deletes: child rows must be scoped to their parent', () => {
  const delivery = source('src/app/actions/delivery.ts');

  // Verifying the parent's shop_id is not enough: the delete itself must also be
  // filtered by the parent id, or a caller can pair their own parent id with
  // another shop's child id and delete across tenants.
  it('deletePreorderItemAction scopes the delete by round_id', () => {
    assert.match(
      delivery,
      /\.from\('preorder_items'\)\s*\.delete\(\)\s*\.eq\('id', itemId\)\s*\.eq\('round_id', roundId\)/,
      'preorder item delete must be filtered by round_id, not by the item id alone'
    );
  });

  it('deleteTripItemAction scopes the delete by trip_id', () => {
    assert.match(
      delivery,
      /\.from\('delivery_trip_items'\)\s*\.delete\(\)\s*\.eq\('id', itemId\)\s*\.eq\('trip_id', tripId\)/,
      'trip item delete must be filtered by trip_id, not by the item id alone'
    );
  });
});

describe('Superadmin server actions authorization guards', () => {
  const superadminSource = source('src/app/actions/superadmin.ts');

  function extractFn(name: string): string {
    const start = superadminSource.indexOf(`export async function ${name}`);
    assert.ok(start !== -1, `Function ${name} not found in superadmin.ts`);
    const nextExport = superadminSource.indexOf('\nexport ', start + 1);
    return superadminSource.slice(start, nextExport !== -1 ? nextExport : undefined);
  }

  const superadminActions = [
    'deleteStoreAction',
    'getAllStoresAction',
    'updateStoreStatusAction',
    'updateStorePlanAction',
  ];

  for (const fnName of superadminActions) {
    it(`${fnName} calls checkIsSuperadmin() and returns before createAdminClient()`, () => {
      const fn = extractFn(fnName);
      const checkIdx = fn.indexOf('checkIsSuperadmin()');
      const createAdminIdx = fn.indexOf('createAdminClient()');

      assert.ok(checkIdx !== -1, `${fnName} must call checkIsSuperadmin()`);
      assert.ok(createAdminIdx !== -1, `${fnName} must call createAdminClient()`);
      assert.ok(
        checkIdx < createAdminIdx,
        `${fnName} must call checkIsSuperadmin() BEFORE createAdminClient()`
      );

      // Must guard against !isSuperadmin and return early
      const between = fn.slice(checkIdx, createAdminIdx);
      assert.match(
        between,
        /if\s*\(\s*!isSuperadmin\s*\)\s*\{\s*return\b/,
        `${fnName} must return early if !isSuperadmin before calling createAdminClient()`
      );
    });
  }
});

describe('SlipOK settings domain allowlist and authorization guards', () => {
  const settingsSource = source('src/app/actions/settings.ts');

  function extractSettingsFn(name: string): string {
    const start = settingsSource.indexOf(`export async function ${name}`);
    assert.ok(start !== -1, `Function ${name} not found in settings.ts`);
    const nextExport = settingsSource.indexOf('\nexport ', start + 1);
    return settingsSource.slice(start, nextExport !== -1 ? nextExport : undefined);
  }

  it('saveSlipCredentialsAction checks shop access (has_shop_access)', () => {
    const fn = extractSettingsFn('saveSlipCredentialsAction');
    assert.match(
      fn,
      /has_shop_access[\s\S]*?lookup_shop_id:\s*data\.shop_id/,
      'saveSlipCredentialsAction must check has_shop_access for data.shop_id'
    );
  });

  it('saveSlipCredentialsAction validates hostname strictly using new URL().hostname === api.slipok.com', () => {
    const fn = extractSettingsFn('saveSlipCredentialsAction');
    assert.match(
      fn,
      /new\s+URL\(/,
      'saveSlipCredentialsAction must parse URL using new URL()'
    );
    assert.match(
      fn,
      /\.hostname\s*!==\s*['"]api\.slipok\.com['"]|\.hostname\s*===\s*['"]api\.slipok\.com['"]/,
      'saveSlipCredentialsAction must strictly check .hostname === api.slipok.com'
    );

    // Verify domain allowlist logic against malicious suffixes
    const safeUrl = new URL('https://api.slipok.com/api/line/apikey/1');
    const evilSubdomain = new URL('https://api.slipok.com.evil.co/steal');
    const evilPrefix = new URL('https://evil-api.slipok.com/steal');

    assert.equal(safeUrl.hostname === 'api.slipok.com', true);
    assert.equal(evilSubdomain.hostname === 'api.slipok.com', false);
    assert.equal(evilPrefix.hostname === 'api.slipok.com', false);
  });
});

describe('Payment slips storage RLS policy migration', () => {
  it('new migration exists and scopes payment-slips viewing to has_shop_access', () => {
    const migration = source('supabase/migrations/20260913000001_secure_payment_slips_storage_policy.sql');
    assert.match(
      migration,
      /drop\s+policy\s+if\s+exists\s+"Staff can view payment slips"\s+on\s+storage\.objects/i,
      'Migration must drop old open policy'
    );
    assert.match(
      migration,
      /create\s+policy\s+"Staff can view payment slips"[\s\S]*?has_shop_access/i,
      'Migration must recreate policy using has_shop_access'
    );
    assert.match(
      migration,
      /storage\.foldername\(name\)/i,
      'Migration must extract shop_id from storage foldername'
    );
  });
});

describe('SlipOK webhook security: fail-closed on missing secret', () => {
  it('webhooks/slipok rejects with HTTP 500 when SLIPOK_WEBHOOK_SECRET is not configured', () => {
    const webhookSource = source('src/app/api/webhooks/slipok/route.ts');
    assert.match(
      webhookSource,
      /if\s*\(\s*!expectedSecret\s*\)\s*\{[\s\S]*?status:\s*500\s*\}/,
      'Webhook must return 500 when expected secret is missing (fail-closed)'
    );
    // Must NOT have the old fail-open if (expectedSecret) { ... } pattern without else
    assert.doesNotMatch(
      webhookSource,
      /if\s*\(\s*expectedSecret\s*\)\s*\{[\s\S]*?incomingSecret\s*!==\s*expectedSecret[\s\S]*?\}\s*const payload = await req\.json\(\);/,
      'Webhook must not skip validation when secret is undefined'
    );
  });
});

describe('Resource-level shop_id binding in mutations', () => {
  it('updateShopSettingsAction checks user authentication and has_shop_access', () => {
    const settings = source('src/app/actions/settings.ts');
    const start = settings.indexOf('export async function updateShopSettingsAction');
    const nextExport = settings.indexOf('\nexport ', start + 1);
    const fn = settings.slice(start, nextExport !== -1 ? nextExport : undefined);

    assert.match(fn, /has_shop_access[\s\S]*?lookup_shop_id:\s*data\.shop_id/);
  });

  it('updateMenuItemAction binds update to item shop_id and checks has_shop_access', () => {
    const menu = source('src/app/actions/menu.ts');
    const start = menu.indexOf('export async function updateMenuItemAction');
    const nextExport = menu.indexOf('\nexport ', start + 1);
    const fn = menu.slice(start, nextExport !== -1 ? nextExport : undefined);

    assert.match(fn, /\.from\('menu_items'\)\s*\.select\('shop_id'\)\s*\.eq\('id',\s*data\.id\)/);
    assert.match(fn, /has_shop_access[\s\S]*?lookup_shop_id:\s*item\.shop_id/);
  });

  it('deleteMenuItemAction binds delete to item shop_id and checks has_shop_access', () => {
    const menu = source('src/app/actions/menu.ts');
    const start = menu.indexOf('export async function deleteMenuItemAction');
    const nextExport = menu.indexOf('\nexport ', start + 1);
    const fn = menu.slice(start, nextExport !== -1 ? nextExport : undefined);

    assert.match(fn, /\.from\('menu_items'\)\s*\.select\('shop_id'\)\s*\.eq\('id',\s*itemId\)/);
    assert.match(fn, /has_shop_access[\s\S]*?lookup_shop_id:\s*item\.shop_id/);
  });

  it('confirmCashPaymentAction queries order shop_id and checks has_shop_access', () => {
    const order = source('src/app/actions/order.ts');
    const start = order.indexOf('export async function confirmCashPaymentAction');
    const nextExport = order.indexOf('\nexport ', start + 1);
    const fn = order.slice(start, nextExport !== -1 ? nextExport : undefined);

    assert.match(fn, /\.from\('orders'\)\s*\.select\('id,\s*shop_id'\)\s*\.eq\('id',\s*orderId\)/);
    assert.match(fn, /has_shop_access[\s\S]*?lookup_shop_id:\s*order\.shop_id/);
  });
});
