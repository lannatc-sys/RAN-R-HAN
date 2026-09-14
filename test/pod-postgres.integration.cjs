/**
 * Proof of Delivery — integration test กับ PostgreSQL จริง
 *
 *   TEST_DATABASE_URL=postgres://... node test/pod-postgres.integration.cjs
 *
 * เทสชุดนี้เรียก RPC `finalize_rider_delivery_event` ตัวจริงในฐานข้อมูล
 * ไม่มี mock ไม่มีการจำลองพฤติกรรม ทุกข้อความ error ที่ตรวจมาจากฟังก์ชันจริง
 * เพราะเทสที่อ่านไฟล์แล้ว regex พิสูจน์ไม่ได้ว่า SQL ทำงานถูก
 */

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

const ids = {
  shopA: '50000000-0000-4000-8000-000000000001',
  shopB: '50000000-0000-4000-8000-000000000002',
  userA: '51000000-0000-4000-8000-000000000001',
  userB: '51000000-0000-4000-8000-000000000002',
  riderA: '52000000-0000-4000-8000-000000000001',
  riderB: '52000000-0000-4000-8000-000000000002',
  orderA: '53000000-0000-4000-8000-000000000001',
  orderB: '53000000-0000-4000-8000-000000000002',
  orderCooking: '53000000-0000-4000-8000-000000000003',
};

let podSeq = 0;
const nextPodId = () =>
  '54000000-0000-4000-8000-0000000000' + String(++podSeq).padStart(2, '0');

async function connect() {
  const client = new Client({
    connectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set statement_timeout = '10s'");
  return client;
}

/** สวมบทผู้ใช้แบบเดียวกับที่ PostgREST ทำ เพื่อให้ auth.uid() คืนค่าจริง */
async function asRider(client, authUserId, callback) {
  await client.query('begin');
  try {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [authUserId]);
    await client.query('set local role authenticated');
    const result = await callback();
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function expectError(fn, fragment) {
  try {
    await fn();
  } catch (error) {
    if (error && error.code === 'ERR_ASSERTION') throw error;
    assert.match(String(error && error.message), new RegExp(fragment, 'i'));
    return;
  }
  assert.fail(`ต้องล้มด้วย ${fragment} แต่กลับสำเร็จ`);
}

async function cleanFixtures(client) {
  await client.query('reset role');
  await client.query('delete from public.orders where id = any($1::uuid[])', [
    [ids.orderA, ids.orderB, ids.orderCooking],
  ]);
  await client.query('delete from public.riders where id = any($1::uuid[])', [
    [ids.riderA, ids.riderB],
  ]);
  await client.query('delete from public.shops where id = any($1::uuid[])', [
    [ids.shopA, ids.shopB],
  ]);
  await client.query('delete from auth.users where id = any($1::uuid[])', [
    [ids.userA, ids.userB],
  ]);
}

async function seedFixtures(client) {
  await cleanFixtures(client);

  await client.query(
    `insert into auth.users (id, email)
     values ($1, 'pod-rider-a@example.invalid'), ($2, 'pod-rider-b@example.invalid')`,
    [ids.userA, ids.userB]
  );
  await client.query(
    `insert into public.shops (id, slug, name, allow_delivery, is_delivery_enabled)
     values ($1, 'pod-shop-a', 'POD Shop A', true, true),
            ($2, 'pod-shop-b', 'POD Shop B', true, true)`,
    [ids.shopA, ids.shopB]
  );
  await client.query(
    `insert into public.riders (id, shop_id, auth_user_id, display_name, phone, status)
     values ($1, $2, $3, 'POD Rider A', '0990000011', 'active'),
            ($4, $5, $6, 'POD Rider B', '0990000012', 'active')`,
    [ids.riderA, ids.shopA, ids.userA, ids.riderB, ids.shopB, ids.userB]
  );
  await client.query(
    `insert into public.orders (
       id, shop_id, order_no, type, subtotal, total,
       delivery_address, delivery_lat, delivery_lng,
       assigned_rider_id, dispatch_status, status
     ) values
       ($1, $2, 'POD-A-001', 'delivery', 100, 100, 'ปลายทาง A', 13.7564, 100.5018, $3, 'assigned', 'served'),
       ($4, $5, 'POD-B-001', 'delivery', 100, 100, 'ปลายทาง B', 13.7564, 100.5018, $6, 'assigned', 'served'),
       ($7, $2, 'POD-A-002', 'delivery', 100, 100, 'ปลายทาง A2', 13.7564, 100.5018, $3, 'assigned', 'cooking')`,
    [ids.orderA, ids.shopA, ids.riderA, ids.orderB, ids.shopB, ids.riderB, ids.orderCooking]
  );
}

/** สร้างแถว POD แบบเดียวกับที่ route อัปโหลดสร้าง (delivery_event_id ว่างเสมอ) */
async function insertPod(client, { orderId, riderId, shopId, eventType = 'delivered' }) {
  const id = nextPodId();
  await client.query(
    `insert into public.pod_uploads (
       id, order_id, rider_id, shop_id, delivery_event_id,
       storage_path, event_type, server_received_at
     ) values ($1, $2, $3, $4, null, $5, $6, now())`,
    [id, orderId, riderId, shopId, `pod/${shopId}/${orderId}/${Date.now()}_${eventType}.jpg`, eventType]
  );
  return id;
}

const finalize = (client, orderId, eventType, podId = null) =>
  client.query('select public.finalize_rider_delivery_event($1, $2, null, null, null, $3) as r', [
    orderId,
    eventType,
    podId,
  ]);

const orderRow = async (client, orderId) =>
  (
    await client.query('select status::text, dispatch_status from public.orders where id = $1', [
      orderId,
    ])
  ).rows[0];

/** เดินตาม state machine จนถึงก่อนส่งของ เพื่อให้เคส delivered ทดสอบได้ */
async function walkToDoorstep(client, orderId, authUserId) {
  for (const step of ['departed_to_shop', 'arrived_at_shop', 'picked_up', 'departed_to_customer']) {
    await asRider(client, authUserId, () => finalize(client, orderId, step));
  }
}

async function run() {
  const admin = await connect();

  try {
    await seedFixtures(admin);

    // --- 1. เฉพาะไรเดอร์ที่ถือ order นี้เท่านั้น -----------------------------
    await expectError(
      () => asRider(admin, ids.userB, () => finalize(admin, ids.orderA, 'departed_to_shop')),
      'ORDER_FORBIDDEN'
    );
    console.log('[PASS] ไรเดอร์ร้านอื่นแตะ order นี้ไม่ได้');

    await expectError(
      () => admin.query('reset role').then(() => finalize(admin, ids.orderA, 'departed_to_shop')),
      'UNAUTHORIZED'
    );
    console.log('[PASS] ไม่ได้ล็อกอินทำอะไรไม่ได้');

    // --- 8. event_type ที่ไม่รู้จักต้องถูกปฏิเสธ -----------------------------
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'teleported')),
      'INVALID_DELIVERY_EVENT'
    );
    console.log('[PASS] event_type ที่ไม่รู้จักถูกปฏิเสธ');

    // --- 10. ข้ามขั้นไปส่งของเลยไม่ได้ ---------------------------------------
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered')),
      'INVALID_EVENT_TRANSITION'
    );
    let after = await orderRow(admin, ids.orderA);
    assert.equal(after.dispatch_status, 'assigned', 'สถานะต้องไม่ขยับเมื่อ transition ไม่ผ่าน');
    console.log('[PASS] ข้ามขั้นตอนไปส่งของไม่ได้ และสถานะไม่ขยับ');

    // --- picked_up ทำให้เป็น in_transit -------------------------------------
    await asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'departed_to_shop'));
    await asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'arrived_at_shop'));
    await asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'picked_up'));
    after = await orderRow(admin, ids.orderA);
    assert.equal(after.dispatch_status, 'in_transit');
    console.log('[PASS] รับอาหารแล้วสถานะเป็น in_transit');

    await asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'departed_to_customer'));

    // --- 8. ส่งของโดยไม่มี POD ต้องถูกปฏิเสธ ---------------------------------
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered')),
      'POD_REQUIRED'
    );
    after = await orderRow(admin, ids.orderA);
    assert.equal(after.dispatch_status, 'in_transit', 'ไม่มี POD แล้วต้องไม่เปลี่ยนเป็น delivered');
    console.log('[PASS] ส่งของโดยไม่มี POD ถูกปฏิเสธ และสถานะไม่เปลี่ยน');

    // --- 5. POD ของ order อื่น / ร้านอื่น ใช้ไม่ได้ --------------------------
    const podOfOtherOrder = await insertPod(admin, {
      orderId: ids.orderB,
      riderId: ids.riderB,
      shopId: ids.shopB,
    });
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered', podOfOtherOrder)),
      'INVALID_OR_USED_POD'
    );
    console.log('[PASS] POD ข้าม order และข้ามร้านถูกปฏิเสธ');

    const podOfOtherRider = await insertPod(admin, {
      orderId: ids.orderA,
      riderId: ids.riderB,
      shopId: ids.shopA,
    });
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered', podOfOtherRider)),
      'INVALID_OR_USED_POD'
    );
    console.log('[PASS] POD ที่ไรเดอร์คนอื่นอัปโหลดใช้ไม่ได้');

    after = await orderRow(admin, ids.orderA);
    assert.equal(after.dispatch_status, 'in_transit', 'POD ที่ไม่ถูกต้องต้องไม่ทิ้ง state ครึ่ง ๆ');
    console.log('[PASS] POD ไม่ถูกต้องแล้วไม่มี partial state');

    // --- 6. ส่งของสำเร็จพร้อม POD ที่ถูกต้อง ---------------------------------
    const goodPod = await insertPod(admin, {
      orderId: ids.orderA,
      riderId: ids.riderA,
      shopId: ids.shopA,
    });
    await asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered', goodPod));
    after = await orderRow(admin, ids.orderA);
    assert.equal(after.dispatch_status, 'delivered');
    console.log('[PASS] ส่งของพร้อม POD ที่ถูกต้องแล้วสถานะเป็น delivered');

    const claimed = (
      await admin.query('select delivery_event_id from public.pod_uploads where id = $1', [goodPod])
    ).rows[0];
    assert.ok(claimed.delivery_event_id, 'POD ต้องถูกผูกกับ delivery event ที่เพิ่งสร้าง');
    console.log('[PASS] POD ถูกผูกกับ event ที่ถูกต้อง');

    // --- 10. สถานะฝั่งลูกค้าต้องไม่ถูกแตะโดยเส้นทางไรเดอร์ --------------------
    assert.equal(
      after.status,
      'completed',
      'ส่งของสำเร็จแล้ว orders.status ต้องปิดเป็น completed ในธุรกรรมเดียวกัน'
    );
    console.log('[PASS] ส่งของสำเร็จแล้วออเดอร์ถูกปิดเป็น completed ครบวงจร');

    // --- ครัวยังไม่กดเสิร์ฟ ต้องปิดงานส่งไม่ได้ และไม่มีอะไรถูกเขียน ---------
    //
    // ก่อนมี 20260914000011 ฟังก์ชันนี้ไม่เคยอ่าน orders.status เลย
    // จึงปิดงานได้แม้ครัวยังทำอาหารอยู่ ทำให้สองสถานะขัดกันเอง
    await walkToDoorstep(admin, ids.orderCooking, ids.userA);
    const podCooking = await insertPod(admin, {
      orderId: ids.orderCooking,
      riderId: ids.riderA,
      shopId: ids.shopA,
    });
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderCooking, 'delivered', podCooking)),
      'ORDER_NOT_SERVED'
    );

    const cookingRow = await orderRow(admin, ids.orderCooking);
    assert.equal(cookingRow.status, 'cooking', 'สถานะครัวต้องไม่ขยับ');
    assert.equal(cookingRow.dispatch_status, 'in_transit', 'สถานะการส่งต้องไม่ขยับ');

    const cookingPod = (
      await admin.query('select delivery_event_id from public.pod_uploads where id = $1', [podCooking])
    ).rows[0];
    assert.equal(cookingPod.delivery_event_id, null, 'POD ต้องไม่ถูกผูกเมื่อธุรกรรมถูกย้อน');

    const cookingEvents = (
      await admin.query(
        "select count(*)::int as n from public.delivery_events where order_id = $1 and event_type = 'delivered'",
        [ids.orderCooking]
      )
    ).rows[0].n;
    assert.equal(cookingEvents, 0, 'ธุรกรรมต้องย้อนทั้งหมด ไม่เหลือ event ค้าง');
    console.log('[PASS] ครัวยังไม่กดเสิร์ฟ ปิดงานส่งไม่ได้ และไม่มี state ค้างเลย');

    // --- 7. ยิงซ้ำต้องไม่ทำ state เพี้ยน -------------------------------------
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered', goodPod)),
      'INVALID_EVENT_TRANSITION|INVALID_OR_USED_POD'
    );
    after = await orderRow(admin, ids.orderA);
    assert.equal(after.dispatch_status, 'delivered', 'ยิงซ้ำแล้วสถานะต้องคงเดิม');
    console.log('[PASS] ยิง delivered ซ้ำด้วย POD เดิมถูกปฏิเสธ สถานะคงเดิม');

    const freshPod = await insertPod(admin, {
      orderId: ids.orderA,
      riderId: ids.riderA,
      shopId: ids.shopA,
    });
    await expectError(
      () => asRider(admin, ids.userA, () => finalize(admin, ids.orderA, 'delivered', freshPod)),
      'INVALID_EVENT_TRANSITION'
    );
    const freshStill = (
      await admin.query('select delivery_event_id from public.pod_uploads where id = $1', [freshPod])
    ).rows[0];
    assert.equal(freshStill.delivery_event_id, null, 'POD ใบใหม่ต้องไม่ถูกผูกเมื่อ transition ไม่ผ่าน');
    console.log('[PASS] ส่งซ้ำด้วย POD ใบใหม่ถูกปฏิเสธ และ POD ไม่ถูกผูกทิ้งไว้');

    const eventCount = (
      await admin.query(
        "select count(*)::int as n from public.delivery_events where order_id = $1 and event_type = 'delivered'",
        [ids.orderA]
      )
    ).rows[0].n;
    assert.equal(eventCount, 1, 'ต้องมี delivered เพียงครั้งเดียว ไม่นับซ้ำ');
    console.log('[PASS] มี event delivered ครั้งเดียว ไม่นับงานซ้ำ');
  } finally {
    try {
      await cleanFixtures(admin);
    } finally {
      await admin.end();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] POD PostgreSQL integration:', error.message);
  process.exitCode = 1;
});
