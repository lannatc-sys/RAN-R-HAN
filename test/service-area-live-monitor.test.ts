import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Service Area Map live integration', () => {
  const client = () =>
    source('src/app/superadmin/service-area-map/ServiceAreaMapClient.tsx');

  it('does not describe the production page as a scaffold or unsaved preview', () => {
    const page = source('src/app/superadmin/service-area-map/page.tsx');
    assert.doesNotMatch(page, /ทดลองหน้าตา|ยังไม่บันทึกลงฐานข้อมูล|ยังไม่มีผลกับร้านใด/);

    const panel = source('src/components/service-area-map/PolygonDraftPanel.tsx');
    assert.match(panel, /mode\?: 'scaffold' \| 'live'/);
    assert.match(panel, /mode === 'scaffold'/);
  });

  it('keeps the authoritative shop state in sync after location and settings saves', () => {
    const code = client();
    assert.match(code, /const \[shopState, setShopState\] = useState<ShopAreaPin\[]>\(shops\)/);
    assert.match(code, /patchShopAreaPin/);
    assert.match(code, /const savedShop = res\.shop/);
    assert.match(code, /shop_lat: savedShop\.shop_lat/);
    assert.match(code, /service_area_enabled: savedShop\.service_area_enabled/);
  });

  it('reloads the authoritative polygon into a fresh editor after save or delete', () => {
    const code = client();
    assert.match(code, /key={`\$\{selectedShopId/);
    assert.match(code, /reloadToken/);
    assert.ok(
      (code.match(/setReloadToken\(\(n\) => n \+ 1\)/g) ?? []).length >= 2,
      'ทั้ง save และ delete ต้องโหลด polygon จากฐานข้อมูลใหม่'
    );
  });

  it('redraws and recenters the Leaflet map after its async import is ready', () => {
    const map = source('src/components/superadmin/ServiceAreaLeafletCanvas.tsx');
    assert.match(map, /const \[mapReady, setMapReady\] = useState\(false\)/);
    assert.match(map, /setMapReady\(true\)/);
    assert.match(map, /setView\(at/);
  });
});

describe('Rider Live Monitor contract', () => {
  const migration = () =>
    source('supabase/migrations/20260914000009_rider_live_monitor.sql');

  it('exposes a minimal superadmin-only snapshot rooted at every rider', () => {
    const sql = migration();
    assert.match(sql, /get_rider_live_monitor_snapshot/);
    assert.match(sql, /auth\.uid\(\) is null or not public\.is_superadmin\(\)/);
    assert.match(sql, /from public\.riders r/);
    assert.match(sql, /left join public\.rider_current_locations/);
    assert.match(sql, /public\.is_point_in_shop_area/);
    assert.match(sql, /left join lateral[\s\S]*public\.orders/);
    assert.match(sql, /left join lateral[\s\S]*public\.dispatch_offers/);
    const query = sql.slice(sql.indexOf('return query'), sql.indexOf('revoke all'));
    assert.doesNotMatch(query, /\bphone\b|delivery_address|customer_name|customer_phone/);
    assert.match(sql, /revoke all on function public\.get_rider_live_monitor_snapshot/);
    assert.match(sql, /grant execute[\s\S]*to authenticated/);
  });

  it('rejects stale GPS rows before dispatch selection', () => {
    const sql = source(
      'supabase/migrations/20260914000010_reject_stale_dispatch_locations.sql'
    );
    assert.match(sql, /pg_get_functiondef/);
    assert.match(sql, /updated_at >= statement_timestamp\(\) - interval '90 seconds'/);
    assert.match(sql, /raise exception/);
  });

  it('checks superadmin before invoking the snapshot RPC', () => {
    const actions = source('src/app/actions/superadmin.ts');
    const start = actions.indexOf('export async function getRiderLiveMonitorSnapshotAction');
    assert.notEqual(start, -1);
    const fn = actions.slice(start, actions.indexOf('\nexport ', start + 1));
    const guard = fn.indexOf('checkIsSuperadmin()');
    const rpc = fn.indexOf("supabase.rpc('get_rider_live_monitor_snapshot'");
    assert.ok(guard >= 0 && rpc > guard, 'ต้องตรวจสิทธิ์ก่อนเรียก RPC');
    assert.doesNotMatch(fn, /createAdminClient/);
  });

  it('polls every five seconds without overlapping requests and pauses while hidden', () => {
    const client = source(
      'src/app/superadmin/rider-live-monitor/RiderLiveMonitorClient.tsx'
    );
    assert.match(client, /POLL_INTERVAL_MS = 5_000/);
    assert.match(client, /inFlightRef/);
    assert.match(client, /document\.visibilityState/);
    assert.match(client, /visibilitychange/);
  });

  it('is linked from the protected superadmin navigation', () => {
    const sidebar = source('src/components/superadmin/SuperadminSidebar.tsx');
    assert.match(sidebar, /\/superadmin\/rider-live-monitor/);

    const page = source('src/app/superadmin/rider-live-monitor/page.tsx');
    assert.match(page, /getRiderLiveMonitorSnapshotAction/);
  });

  it('filters offline, stale, outside-area and active-job riders without hiding all-rider data', async () => {
    const { filterRiderMonitorRows } = await import(
      '../src/lib/rider-live-monitor'
    );
    const base = {
      rider_id: 'rider-1',
      shop_id: 'shop-1',
      shop_name: 'ร้านหนึ่ง',
      display_name: 'ไรเดอร์หนึ่ง',
      rider_status: 'active',
      work_session_id: null,
      session_started_at: null,
      lat: null,
      lng: null,
      accuracy: null,
      heading: null,
      speed: null,
      location_updated_at: null,
      gps_age_seconds: null,
      location_is_stale: true,
      outside_area_since: null,
      inside_work_area: null,
      service_area_enabled: true,
      uses_rider_polygon: false,
      active_order_id: null,
      active_order_no: null,
      active_order_dispatch_status: null,
      active_offer_id: null,
      active_offer_order_id: null,
      active_offer_status: null,
      active_offer_timeout_at: null,
    };
    const rows = [
      base,
      {
        ...base,
        rider_id: 'rider-2',
        display_name: 'ไรเดอร์สอง',
        work_session_id: 'session-2',
        lat: 19.3,
        lng: 97.9,
        location_is_stale: true,
        inside_work_area: false,
        active_order_id: 'order-2',
      },
    ];

    assert.deepEqual(
      filterRiderMonitorRows(rows, { shopId: 'all', status: 'offline', query: '' })
        .map((row) => row.rider_id),
      ['rider-1']
    );
    for (const status of ['stale', 'outside', 'active_job'] as const) {
      assert.deepEqual(
        filterRiderMonitorRows(rows, { shopId: 'all', status, query: '' })
          .map((row) => row.rider_id),
        ['rider-2']
      );
    }
  });
});
