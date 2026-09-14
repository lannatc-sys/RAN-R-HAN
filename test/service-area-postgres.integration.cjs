const assert = require('node:assert/strict');
const { Client } = require('pg');

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error('TEST_DATABASE_URL is required');
}

const databaseUrl = new URL(connectionString);
const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const isLocalDatabase = localHosts.has(databaseUrl.hostname);
if (!isLocalDatabase && process.env.ALLOW_REMOTE_TEST_DATABASE !== 'true') {
  throw new Error(
    'Refusing non-local database. Use a disposable database and set ALLOW_REMOTE_TEST_DATABASE=true explicitly.'
  );
}

const ssl = isLocalDatabase ? false : { rejectUnauthorized: false };
const ids = {
  shopA: '10000000-0000-4000-8000-000000000001',
  shopB: '10000000-0000-4000-8000-000000000002',
  ownerA: '20000000-0000-4000-8000-000000000001',
  ownerB: '20000000-0000-4000-8000-000000000002',
  riderUser: '20000000-0000-4000-8000-000000000003',
  superadmin: '20000000-0000-4000-8000-000000000004',
  rider: '30000000-0000-4000-8000-000000000001',
  insideOrder: '40000000-0000-4000-8000-000000000001',
  outsideOrder: '40000000-0000-4000-8000-000000000002',
  missingCoordinateOrder: '40000000-0000-4000-8000-000000000003',
  insidePolygonOrder: '40000000-0000-4000-8000-000000000004',
  outsidePolygonOrder: '40000000-0000-4000-8000-000000000005',
};

const allowedRoles = new Set(['authenticated', 'service_role']);

async function connect() {
  const client = new Client({ connectionString, ssl });
  await client.connect();
  await client.query("set statement_timeout = '10s'");
  return client;
}

async function asRole(client, role, userId, callback) {
  assert.ok(allowedRoles.has(role), `Unsupported test role: ${role}`);
  await client.query('begin');
  try {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || '']);
    await client.query(`set local role ${role}`);
    const result = await callback();
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function expectDatabaseError(callback, expectedFragment) {
  try {
    await callback();
    assert.fail(`Expected database error containing ${expectedFragment}`);
  } catch (error) {
    if (error && error.code === 'ERR_ASSERTION') throw error;
    assert.match(String(error && error.message), new RegExp(expectedFragment, 'i'));
  }
}

async function cleanFixtures(client) {
  await client.query('reset role');
  await client.query('delete from public.shops where id = any($1::uuid[])', [[ids.shopA, ids.shopB]]);
  await client.query(
    'delete from auth.users where id = any($1::uuid[])',
    [[ids.ownerA, ids.ownerB, ids.riderUser, ids.superadmin]]
  );
}

async function seedFixtures(client) {
  await cleanFixtures(client);
  await client.query(
    `insert into auth.users (id, email)
     values ($1, 'p1-owner-a@example.invalid'),
            ($2, 'p1-owner-b@example.invalid'),
            ($3, 'p1-rider@example.invalid'),
            ($4, 'p1-superadmin@example.invalid')`,
    [ids.ownerA, ids.ownerB, ids.riderUser, ids.superadmin]
  );
  await client.query(
    `insert into public.shops (
       id, slug, name, allow_delivery, is_delivery_enabled,
       shop_lat, shop_lng, service_area_enabled, service_radius_m, rider_work_radius_m
     ) values
       ($1, 'p1-service-area-a', 'P1 Service Area A', true, true, 13.7563, 100.5018, true, 5000, 10000),
       ($2, 'p1-service-area-b', 'P1 Service Area B', true, true, 13.7563, 100.5018, true, 5000, 10000)`,
    [ids.shopA, ids.shopB]
  );
  await client.query(
    `insert into public.users (id, shop_id, role, full_name)
     values ($1, $3, 'owner', 'P1 Owner A'),
            ($2, $4, 'owner', 'P1 Owner B'),
            ($5, null, 'superadmin', 'P1 Superadmin')`,
    [ids.ownerA, ids.ownerB, ids.shopA, ids.shopB, ids.superadmin]
  );
  await client.query(
    `insert into public.riders (id, shop_id, auth_user_id, display_name, phone)
     values ($1, $2, $3, 'P1 Rider', '0990000001')`,
    [ids.rider, ids.shopA, ids.riderUser]
  );
}

async function run() {
  const admin = await connect();
  let ownerClient;
  let riderClient;

  try {
    await seedFixtures(admin);

    // 20260914000002 ยกสิทธิ์คุมพื้นที่จากเจ้าของร้านไปเป็น superadmin เท่านั้น
    const superadminSettings = await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query(
        'select public.set_shop_service_area_settings($1, true, 6000, 12000) as result',
        [ids.shopA]
      )
    );
    assert.equal(superadminSettings.rows[0].result.service_radius_m, 6000);
    console.log('[PASS] superadmin can update shop service-area settings');

    await expectDatabaseError(
      () => asRole(admin, 'authenticated', ids.ownerA, () =>
        admin.query('select public.set_shop_service_area_settings($1, true, 7000, 12000)', [ids.shopA])
      ),
      'SHOP_ACCESS_DENIED'
    );
    console.log('[PASS] shop owner can no longer move its own service-area boundary');

    await expectDatabaseError(
      () => asRole(admin, 'authenticated', ids.ownerB, () =>
        admin.query('select public.update_shop_geo($1, 13.75, 100.50)', [ids.shopA])
      ),
      'SHOP_ACCESS_DENIED'
    );
    console.log('[PASS] cross-shop geo update is denied');

    await expectDatabaseError(
      () => asRole(admin, 'authenticated', ids.superadmin, () =>
        admin.query('select public.update_shop_geo($1, null, null)', [ids.shopA])
      ),
      'SHOP_COORDINATES_REQUIRED'
    );
    console.log('[PASS] enabled shop cannot clear required coordinates');

    const privileges = await admin.query(
      `select
         has_table_privilege('authenticated', 'public.shops', 'UPDATE') as shops_update,
         has_table_privilege('authenticated', 'public.rider_current_locations', 'INSERT') as locations_insert,
         has_table_privilege('authenticated', 'public.rider_current_locations', 'UPDATE') as locations_update,
         has_table_privilege('authenticated', 'public.rider_current_locations', 'DELETE') as locations_delete`
    );
    assert.deepEqual(privileges.rows[0], {
      shops_update: false,
      locations_insert: false,
      locations_update: false,
      locations_delete: false,
    });
    console.log('[PASS] direct writes that bypass RPC locks are revoked');

    await admin.query(
      `insert into public.orders (
         id, shop_id, order_no, type, subtotal, total, delivery_address, delivery_lat, delivery_lng
       ) values ($1, $2, 'P1-IN-001', 'delivery', 100, 100, 'inside', 13.7564, 100.5018)`,
      [ids.insideOrder, ids.shopA]
    );
    console.log('[PASS] delivery order inside service area is accepted');

    await expectDatabaseError(async () => {
      await admin.query('begin');
      try {
        await admin.query(
          `insert into public.orders (
             id, shop_id, order_no, type, subtotal, total, delivery_address, delivery_lat, delivery_lng
           ) values ($1, $2, 'P1-OUT-001', 'delivery', 100, 100, 'outside', 14.20, 101.20)`,
          [ids.outsideOrder, ids.shopA]
        );
        await admin.query('commit');
      } catch (error) {
        await admin.query('rollback');
        throw error;
      }
    }, 'OUTSIDE_SERVICE_AREA');
    console.log('[PASS] delivery order outside service area is rejected');

    await expectDatabaseError(async () => {
      await admin.query('begin');
      try {
        await admin.query(
          `insert into public.orders (
             id, shop_id, order_no, type, subtotal, total, delivery_address, delivery_lat, delivery_lng
           ) values ($1, $2, 'P1-NULL-001', 'delivery', 100, 100, 'missing coordinates', null, null)`,
          [ids.missingCoordinateOrder, ids.shopA]
        );
        await admin.query('commit');
      } catch (error) {
        await admin.query('rollback');
        throw error;
      }
    }, 'OUTSIDE_SERVICE_AREA');
    console.log('[PASS] delivery order without coordinates fails closed');

    // C4 - polygon ต้องชนะรัศมีตอนรับออเดอร์จริง ไม่ใช่แค่มีคอลัมน์เก็บไว้เฉย ๆ
    // จุด 13.7700/100.5018 ยังอยู่ในรัศมี 6 กม. แต่หลุดออกนอกสี่เหลี่ยมที่วาด
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query(
        "select public.set_shop_service_area_polygon($1, 'customer', $2::jsonb)",
        [
          ids.shopA,
          JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [100.4950, 13.7500],
              [100.5100, 13.7500],
              [100.5100, 13.7600],
              [100.4950, 13.7600],
              [100.4950, 13.7500],
            ]],
          }),
        ]
      )
    );

    await admin.query(
      `insert into public.orders (
         id, shop_id, order_no, type, subtotal, total, delivery_address, delivery_lat, delivery_lng
       ) values ($1, $2, 'P1-POLY-IN-001', 'delivery', 100, 100, 'inside polygon', 13.7564, 100.5018)`,
      [ids.insidePolygonOrder, ids.shopA]
    );
    console.log('[PASS] delivery order inside the drawn polygon is accepted');

    await expectDatabaseError(async () => {
      await admin.query('begin');
      try {
        await admin.query(
          `insert into public.orders (
             id, shop_id, order_no, type, subtotal, total, delivery_address, delivery_lat, delivery_lng
           ) values ($1, $2, 'P1-POLY-OUT-001', 'delivery', 100, 100, 'outside polygon inside radius', 13.7700, 100.5018)`,
          [ids.outsidePolygonOrder, ids.shopA]
        );
        await admin.query('commit');
      } catch (error) {
        await admin.query('rollback');
        throw error;
      }
    }, 'OUTSIDE_SERVICE_AREA');
    console.log('[PASS] polygon beats the radius: inside the circle but outside the shape is rejected');

    // ล้าง polygon ก่อนเทสไรเดอร์ ไม่งั้นรูปของลูกค้าจะกวนกรณีถัดไป
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query("select public.set_shop_service_area_polygon($1, 'customer', null)", [ids.shopA])
    );

    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.start_rider_work_session($1, 13.7564, 100.5018, null)', [ids.shopA])
    );
    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.report_rider_location($1, 14.20, 101.20, null, null, null)', [ids.shopA])
    );
    const outsideState = await admin.query(
      `select l.outside_area_since is not null as timer_started, s.status::text as session_status
       from public.rider_current_locations l
       join public.rider_work_sessions s on s.id = l.work_session_id
       where l.rider_id = $1`,
      [ids.rider]
    );
    assert.deepEqual(outsideState.rows[0], { timer_started: true, session_status: 'open' });
    console.log('[PASS] outside rider starts timer without immediate session closure');

    await admin.query(
      "update public.rider_current_locations set outside_area_since = now() - interval '16 minutes' where rider_id = $1",
      [ids.rider]
    );
    const sweep = await asRole(admin, 'service_role', null, () =>
      admin.query('select public.sweep_expired_rider_geofence_sessions() as closed_count')
    );
    assert.equal(sweep.rows[0].closed_count, 1);
    const closed = await admin.query(
      "select count(*)::int as count from public.rider_work_sessions where rider_id = $1 and status = 'open'",
      [ids.rider]
    );
    assert.equal(closed.rows[0].count, 0);
    console.log('[PASS] sweep closes rider session after 15-minute grace period');

    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.start_rider_work_session($1, 13.7564, 100.5018, null)', [ids.shopA])
    );
    console.log('[PASS] rider can start work again after returning inside area');

    // ------------------------------------------------------------------
    // polygon ของไรเดอร์ต้องมีผลจริง ไม่ใช่แค่คอลัมน์ที่เก็บไว้เฉย ๆ
    //
    // ทุกเคสในบล็อกนี้ใช้จุด 13.7700/100.5018 ซึ่งห่างจากร้านราว 1.5 กม.
    // ยัง **อยู่ใน** รัศมีไรเดอร์ แต่ **หลุดออกนอก** สี่เหลี่ยมที่วาด
    // ถ้าโค้ดยังวัดด้วยรัศมีอย่างเดียว ทุกเคสจะผ่านแบบผิด ๆ
    // ------------------------------------------------------------------
    const riderAreaBox = JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [100.4950, 13.7500],
        [100.5100, 13.7500],
        [100.5100, 13.7600],
        [100.4950, 13.7600],
        [100.4950, 13.7500],
      ]],
    });
    const INSIDE = { lat: 13.7564, lng: 100.5018 };
    const OUTSIDE_SHAPE_INSIDE_RADIUS = { lat: 13.7700, lng: 100.5018 };

    const readTimer = async () => {
      const res = await admin.query(
        `select l.outside_area_since is not null as timer_started,
                s.status::text as session_status
           from public.rider_current_locations l
           left join public.rider_work_sessions s on s.id = l.work_session_id
          where l.rider_id = $1`,
        [ids.rider]
      );
      return res.rows[0];
    };

    // ปิด session ที่เปิดค้างอยู่ก่อน จะได้ทดสอบการเริ่มงานใหม่แบบสะอาด
    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.close_rider_work_session(null)')
    );

    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query("select public.set_shop_service_area_polygon($1, 'rider', $2::jsonb)", [
        ids.shopA,
        riderAreaBox,
      ])
    );

    // 1. เริ่มงานจากจุดที่อยู่ในรัศมีแต่นอกรูป ต้องถูกปฏิเสธ
    await expectDatabaseError(
      () => asRole(admin, 'authenticated', ids.riderUser, () =>
        admin.query('select public.start_rider_work_session($1, $2, $3, null)', [
          ids.shopA,
          OUTSIDE_SHAPE_INSIDE_RADIUS.lat,
          OUTSIDE_SHAPE_INSIDE_RADIUS.lng,
        ])
      ),
      'OUTSIDE_WORK_AREA'
    );
    console.log('[PASS] rider polygon: start is refused inside the radius but outside the shape');

    // 2. เริ่มงานจากในรูปได้ตามปกติ
    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.start_rider_work_session($1, $2, $3, null)', [
        ids.shopA,
        INSIDE.lat,
        INSIDE.lng,
      ])
    );
    console.log('[PASS] rider polygon: start is allowed inside the shape');

    // 3. รายงานพิกัดที่นอกรูปแต่ในรัศมี ต้องเริ่มจับเวลา
    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.report_rider_location($1, $2, $3, null, null, null)', [
        ids.shopA,
        OUTSIDE_SHAPE_INSIDE_RADIUS.lat,
        OUTSIDE_SHAPE_INSIDE_RADIUS.lng,
      ])
    );
    assert.deepEqual(await readTimer(), { timer_started: true, session_status: 'open' });
    console.log('[PASS] rider polygon: GPS report outside the shape starts the timer');

    // 4. ขยายรัศมีจนใหญ่เกินจริง ต้องไม่ล้างตัวจับเวลา เพราะ polygon ชนะรัศมี
    //    ก่อนแก้ ฟังก์ชันนี้วัดด้วยรัศมีใหม่แล้วจะล้าง outside_area_since ทิ้ง
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query('select public.set_shop_service_area_settings($1, true, 6000, 50000)', [ids.shopA])
    );
    assert.equal(
      (await readTimer()).timer_started,
      true,
      'ขยายรัศมีไม่ควรดึงไรเดอร์ที่อยู่นอก polygon กลับเข้าเขต'
    );
    console.log('[PASS] rider polygon: widening the radius does not clear the timer');

    // 5. ย้ายพิกัดร้านไปทับตัวไรเดอร์ ก็ยังต้องไม่ล้างตัวจับเวลา ด้วยเหตุผลเดียวกัน
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query('select public.update_shop_geo($1, $2, $3)', [
        ids.shopA,
        OUTSIDE_SHAPE_INSIDE_RADIUS.lat,
        OUTSIDE_SHAPE_INSIDE_RADIUS.lng,
      ])
    );
    assert.equal(
      (await readTimer()).timer_started,
      true,
      'ย้ายพิกัดร้านไม่ควรดึงไรเดอร์ที่อยู่นอก polygon กลับเข้าเขต'
    );
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query('select public.update_shop_geo($1, 13.7563, 100.5018)', [ids.shopA])
    );
    console.log('[PASS] rider polygon: moving the shop pin does not clear the timer');

    // 6. เกิน grace period แล้ว sweep ต้องปิด session โดยตัดสินจาก polygon
    await admin.query(
      "update public.rider_current_locations set outside_area_since = now() - interval '16 minutes' where rider_id = $1",
      [ids.rider]
    );
    const riderPolygonSweep = await asRole(admin, 'service_role', null, () =>
      admin.query('select public.sweep_expired_rider_geofence_sessions() as closed_count')
    );
    assert.equal(riderPolygonSweep.rows[0].closed_count, 1, 'sweep ต้องปิด session ของไรเดอร์ที่อยู่นอก polygon');
    console.log('[PASS] rider polygon: sweep closes the session using the shape, not the radius');

    // คืนสภาพให้เคสถัดไป ลบ polygon ไรเดอร์และเปิด session ใหม่จากในเขต
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query("select public.set_shop_service_area_polygon($1, 'rider', null)", [ids.shopA])
    );
    await asRole(admin, 'authenticated', ids.superadmin, () =>
      admin.query('select public.set_shop_service_area_settings($1, true, 6000, 12000)', [ids.shopA])
    );
    await asRole(admin, 'authenticated', ids.riderUser, () =>
      admin.query('select public.start_rider_work_session($1, $2, $3, null)', [
        ids.shopA,
        INSIDE.lat,
        INSIDE.lng,
      ])
    );

    ownerClient = await connect();
    riderClient = await connect();
    await ownerClient.query('begin');
    await ownerClient.query("select pg_advisory_xact_lock(hashtextextended('shop:' || $1::text, 0))", [ids.shopA]);
    await ownerClient.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.superadmin]);
    await ownerClient.query('set local role authenticated');

    const riderReport = asRole(riderClient, 'authenticated', ids.riderUser, () =>
      riderClient.query('select public.report_rider_location($1, 13.7565, 100.5018, null, null, null)', [ids.shopA])
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    await ownerClient.query(
      'select public.set_shop_service_area_settings($1, true, 6000, 11000)',
      [ids.shopA]
    );
    await ownerClient.query('commit');
    await riderReport;
    console.log('[PASS] concurrent boundary update and GPS report complete without deadlock');
  } finally {
    for (const client of [ownerClient, riderClient]) {
      if (!client) continue;
      try { await client.query('rollback'); } catch {}
      await client.end();
    }
    try {
      await cleanFixtures(admin);
    } finally {
      await admin.end();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] Service-area PostgreSQL integration:', error.message);
  process.exitCode = 1;
});
