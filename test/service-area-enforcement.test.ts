import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

function sqlFunction(sql: string, name: string): string {
  const match = sql.match(
    new RegExp(`create or replace function public\\.${name}\\b[\\s\\S]*?end;\\s*\\$\\$;`, 'i')
  );
  assert.ok(match, `SQL function ${name} not found`);
  return match[0];
}

describe('Service-area database enforcement', () => {
  const migration = source('supabase/migrations/20260912000006_service_area_enforcement.sql');

  it('is included in the database setup migration sequence', () => {
    const runner = source('scripts/run-db.js');
    assert.match(runner, /20260912000005_shop_open_status\.sql/);
    assert.match(runner, /20260912000006_service_area_enforcement\.sql/);
  });

  it('keeps an explicit DATABASE_URL from being overwritten by .env.local', () => {
    const runner = source('scripts/run-db.js');
    assert.match(runner, /if \(!connectionString && fs\.existsSync\(envPath\)\)/);
  });

  it('disables SSL only for local database URLs unless explicitly overridden', () => {
    const runner = source('scripts/run-db.js');
    assert.match(runner, /const isLocalDatabase = \['localhost', '127\.0\.0\.1', '::1'\]\.includes/);
    assert.match(runner, /process\.env\.DATABASE_SSL === 'true'/);
    assert.match(runner, /ssl: useSsl \? \{ rejectUnauthorized: false \} : false/);
  });

  it('provides a PostgreSQL integration verifier that refuses remote databases by default', () => {
    const integration = source('test/service-area-postgres.integration.cjs');
    assert.match(integration, /TEST_DATABASE_URL is required/);
    assert.match(integration, /ALLOW_REMOTE_TEST_DATABASE !== 'true'/);
    assert.match(integration, /concurrent boundary update and GPS report complete without deadlock/);
  });

  it('uses safe defaults and database constraints for enabled shops', () => {
    assert.match(migration, /service_radius_m numeric not null default 5000/i);
    assert.match(migration, /rider_work_radius_m numeric not null default 10000/i);
    assert.match(migration, /check_service_area_configuration/i);
    assert.match(migration, /not service_area_enabled[\s\S]*shop_lat is not null[\s\S]*shop_lng is not null/i);
  });

  it('fails closed for delivery orders with missing or outside coordinates on insert and update', () => {
    assert.match(migration, /before insert or update of type, shop_id, delivery_lat, delivery_lng/i);
    assert.match(migration, /new\.delivery_lat is null or new\.delivery_lng is null[\s\S]*OUTSIDE_SERVICE_AREA/i);
    assert.match(migration, /v_dist > v_shop\.service_radius_m[\s\S]*OUTSIDE_SERVICE_AREA/i);
  });

  it('guards against NULL shop coordinates in trigger to prevent STRICT function bypass', () => {
    // calc_distance_meters is STRICT: NULL inputs → NULL return → (NULL > radius) = unknown → order allowed silently.
    // The trigger must reject before reaching the distance call.
    assert.match(
      migration,
      /v_shop\.shop_lat is null or v_shop\.shop_lng is null[\s\S]*OUTSIDE_SERVICE_AREA/i
    );
  });

  it('serializes every automatic close through one rider-scoped primitive', () => {
    assert.match(migration, /create or replace function public\.close_rider_work_session_internal/i);
    assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_rider_id::text, 0\)\)/i);
    const calls = migration.match(/close_rider_work_session_internal\(/gi) ?? [];
    assert.ok(calls.length >= 4, 'manual, report, and sweep paths must share the close primitive');
  });

  it('binds location reporting to the rider shop and reselects the session after locking', () => {
    assert.match(migration, /report_rider_location\(\s*p_shop_id uuid,/i);
    assert.match(migration, /auth_user_id = auth\.uid\(\)[\s\S]*shop_id = p_shop_id/i);
    assert.match(migration, /pg_advisory_xact_lock[\s\S]*select s\.id[\s\S]*for update/i);
  });

  it('uses extension-safe PostGIS lookup and returns the database timestamp', () => {
    assert.match(migration, /calc_distance_meters[\s\S]*set search_path = public, extensions/i);
    assert.match(migration, /'updated_at', v_now/i);
  });

  it('preserves outside_area_since on unchanged settings save and re-evaluates with per-rider advisory locks', () => {
    // Must check if settings actually changed before touching rider locations
    assert.match(migration, /is distinct from p_enabled/i);
    assert.match(migration, /coalesce\(v_location\.outside_area_since, v_now\)/i);
    // Must use per-rider advisory locks
    assert.match(
      migration,
      /set_shop_service_area_settings[\s\S]*pg_advisory_xact_lock\(hashtextextended\(v_rider\.rider_id::text, 0\)\)/i
    );
  });

  it('runs preflight diagnostic check before creating unique index uq_rider_shop_auth_user', () => {
    assert.match(migration, /MIGRATION_PREFLIGHT_FAILED[\s\S]*uq_rider_shop_auth_user/i);
  });

  it('restricts geofence sweep initial candidate query to rows expired by at least 15 minutes', () => {
    assert.match(migration, /outside_area_since <= \(v_now - interval '15 minutes'\)/i);
  });

  it('re-checks rider active status and shop binding after acquiring the advisory lock during start work', () => {
    assert.match(
      migration,
      /start_rider_work_session[\s\S]*pg_advisory_xact_lock[\s\S]*select 1 from public\.riders[\s\S]*RIDER_NOT_FOUND_OR_INACTIVE/i
    );
  });

  it('provides update_shop_geo RPC with auth, lock, and per-rider re-evaluation', () => {
    assert.match(migration, /create or replace function public\.update_shop_geo/i);
    // Must check auth
    const fn = migration.match(
      /create or replace function public\.update_shop_geo[\s\S]*?end;\s*\$\$/i
    );
    assert.ok(fn, 'update_shop_geo not found');
    assert.match(fn![0], /auth\.uid\(\) is null or not public\.has_shop_access\(p_shop_id\)/i);
    // Must lock shop row
    assert.match(fn![0], /for update/i);
    // Must use per-rider advisory locks
    assert.match(fn![0], /pg_advisory_xact_lock\(hashtextextended\(v_rider\.rider_id::text, 0\)\)/i);
    // Must coalesce outside_area_since to preserve existing timer
    assert.match(fn![0], /coalesce\(v_location\.outside_area_since, v_now\)/i);
  });

  it('does not allow an enabled shop to clear the coordinates required by enforcement', () => {
    const fn = sqlFunction(migration, 'update_shop_geo');
    assert.match(
      fn,
      /v_shop\.service_area_enabled and p_shop_lat is null[\s\S]*?SHOP_COORDINATES_REQUIRED/i
    );
  });

  it('orders every multi-rider advisory-lock loop deterministically', () => {
    for (const name of ['set_shop_service_area_settings', 'update_shop_geo']) {
      const fn = sqlFunction(migration, name);
      assert.match(
        fn,
        /from public\.rider_current_locations[\s\S]*?where shop_id = p_shop_id[\s\S]*?order by rider_id[\s\S]*?loop/i,
        `${name} must acquire rider locks in rider_id order`
      );
    }

    const sweep = sqlFunction(migration, 'sweep_expired_rider_geofence_sessions');
    assert.match(
      sweep,
      /from public\.rider_current_locations[\s\S]*?order by rider_id[\s\S]*?loop/i,
      'sweep must acquire rider locks in rider_id order'
    );
  });

  it('re-reads each rider location after acquiring the advisory lock', () => {
    for (const name of ['set_shop_service_area_settings', 'update_shop_geo']) {
      const fn = sqlFunction(migration, name);
      assert.match(
        fn,
        /pg_advisory_xact_lock[\s\S]*?select[\s\S]*?from public\.rider_current_locations[\s\S]*?where rider_id = v_rider\.rider_id[\s\S]*?for update/i,
        `${name} must use a fresh, row-locked location after taking the rider lock`
      );
    }
  });

  it('serializes disabled-enforcement timer clearing per rider', () => {
    for (const name of ['set_shop_service_area_settings', 'update_shop_geo']) {
      const fn = sqlFunction(migration, name);
      assert.doesNotMatch(
        fn,
        /(?:if not p_enabled|elsif not v_shop\.service_area_enabled)[\s\S]*?update public\.rider_current_locations[\s\S]*?where shop_id = p_shop_id/i,
        `${name} must not bulk-clear timers without rider locks`
      );
    }
  });

  it('uses a shop-scoped read/write lock before rider locks', () => {
    for (const name of ['set_shop_service_area_settings', 'update_shop_geo']) {
      const fn = sqlFunction(migration, name);
      assert.match(
        fn,
        /pg_advisory_xact_lock\(hashtextextended\('shop:' \|\| p_shop_id::text, 0\)\)[\s\S]*?pg_advisory_xact_lock\(hashtextextended\(v_rider\.rider_id::text, 0\)\)/i,
        `${name} must take the exclusive shop lock before rider locks`
      );
    }

    for (const name of ['start_rider_work_session', 'report_rider_location']) {
      const fn = sqlFunction(migration, name);
      assert.match(
        fn,
        /pg_advisory_xact_lock_shared\(hashtextextended\('shop:' \|\| p_shop_id::text, 0\)\)[\s\S]*?pg_advisory_xact_lock\(hashtextextended\(v_rider_id::text, 0\)\)/i,
        `${name} must take the shared shop lock before the rider lock`
      );
    }
  });
});

describe('Rider geofence API and UI', () => {
  it('validates coordinate bounds at both rider API boundaries', () => {
    for (const path of [
      'src/app/api/rider/session/start/route.ts',
      'src/app/api/rider/location/route.ts',
    ]) {
      const route = source(path);
      assert.match(route, /lat < -90 \|\| lat > 90 \|\| lng < -180 \|\| lng > 180/);
    }
  });

  it('sends the shop identity and recovers when cron already closed the session', () => {
    const riderClient = source('src/app/rider/RiderClient.tsx');
    assert.match(riderClient, /JSON\.stringify\(\{ \.\.\.c, shop_id: rider\.shop_id \}\)/);
    assert.match(riderClient, /data\.code === 'WORK_SESSION_REQUIRED'[\s\S]*setSession\(null\)/);
  });

  it('shows the complete required 15-minute warning', () => {
    assert.match(
      source('src/app/rider/RiderClient.tsx'),
      /คุณได้อยู่นอกเขตพื้นที่การทำงาน กรุณากลับเข้าเขตพื้นที่ภายใน 15 นาที กรณีเกิน 15 นาที สามารถกดเริ่มงานใหม่ เพื่อกลับมาทำงานได้ดังเดิม/
    );
  });
});

describe('Shop-admin service-area settings', () => {
  it('adds a dedicated admin navigation destination', () => {
    const navbar = source('src/components/admin/AdminNavbar.tsx');
    assert.match(navbar, /href: '\/admin\/service-area'/);
    assert.match(navbar, /ขอบเขตบริการ/);
  });

  it('uses a session-bound tenant-authorized RPC', () => {
    const action = source('src/app/actions/settings.ts');
    assert.match(action, /updateServiceAreaSettingsAction/);
    assert.match(action, /await createClient\(\)/);
    assert.match(action, /\.rpc\('set_shop_service_area_settings'/);
    assert.match(action, /serviceAreaSettingsSchema\.safeParse/);
  });

  it('uses DB-authoritative RPC for geo updates with rider re-evaluation', () => {
    const action = source('src/app/actions/settings.ts');
    assert.match(action, /\.rpc\('update_shop_geo'/);
    // Must NOT use admin client for geo RPC
    const geoStart = action.indexOf('export async function updateShopGeoAction');
    assert.ok(geoStart !== -1, 'updateShopGeoAction function not found');
    const nextExport = action.indexOf('\nexport ', geoStart + 1);
    const geoFn = action.slice(geoStart, nextExport !== -1 ? nextExport : undefined);
    assert.ok(!geoFn.includes('createAdminClient'), 'Must not use admin client');
  });

  it('provides accessible numeric controls and status feedback', () => {
    const client = source('src/app/admin/service-area/ServiceAreaSettingsClient.tsx');
    assert.match(client, /<fieldset\b/);
    assert.match(client, /<legend\b/);
    assert.match(client, /id="service-radius"/);
    assert.match(client, /id="rider-radius"/);
    assert.match(client, /aria-live="polite"/);
  });

  it('keeps the shared Shop type aligned with the schema', () => {
    const types = source('src/lib/types.ts');
    assert.match(types, /service_area_enabled\?: boolean/);
    assert.match(types, /service_radius_m\?: number/);
    assert.match(types, /rider_work_radius_m\?: number/);
  });
});

describe('Rider geofence sweep endpoint', () => {
  it('fails closed and does not expose database error details', () => {
    const route = source('src/app/api/cron/rider-geofence-sweep/route.ts');
    assert.match(route, /process\.env\.CRON_SECRET/);
    assert.match(route, /status: 502/);
    assert.doesNotMatch(route, /NextResponse\.json\(\{ success: false, error: (?:error|err)\.message/);
  });
});
