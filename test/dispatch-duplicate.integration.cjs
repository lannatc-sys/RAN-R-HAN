/**
 * กันงานซ้ำในเส้นทาง dispatch — integration test กับ PostgreSQL จริง
 *
 *   TEST_DATABASE_URL=postgres://... node test/dispatch-duplicate.integration.cjs
 *
 * ทุกเคสยิง RPC และ constraint ตัวจริง ไม่มี mock
 * เพราะการกันซ้ำอยู่ที่ชั้นฐานข้อมูล (partial unique index + compare-and-swap)
 * ซึ่งเทสที่อ่านไฟล์แล้ว regex พิสูจน์ไม่ได้ว่าทำงานจริง
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
  shop: '60000000-0000-4000-8000-000000000001',
  userA: '61000000-0000-4000-8000-000000000001',
  userB: '61000000-0000-4000-8000-000000000002',
  riderA: '62000000-0000-4000-8000-000000000001',
  riderB: '62000000-0000-4000-8000-000000000002',
  order1: '63000000-0000-4000-8000-000000000001',
  order2: '63000000-0000-4000-8000-000000000002',
  order3: '63000000-0000-4000-8000-000000000003',
};

let offerSeq = 0;
const nextOfferId = () =>
  '64000000-0000-4000-8000-0000000000' + String(++offerSeq).padStart(2, '0');

async function connect() {
  const client = new Client({
    connectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set statement_timeout = '10s'");
  return client;
}

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
  await client.query('delete from public.orders where shop_id = $1', [ids.shop]);
  await client.query('delete from public.riders where shop_id = $1', [ids.shop]);
  await client.query('delete from public.shops where id = $1', [ids.shop]);
  await client.query('delete from auth.users where id = any($1::uuid[])', [[ids.userA, ids.userB]]);
}

async function seedFixtures(client) {
  await cleanFixtures(client);

  await client.query(
    `insert into auth.users (id, email)
     values ($1, 'dup-rider-a@example.invalid'), ($2, 'dup-rider-b@example.invalid')`,
    [ids.userA, ids.userB]
  );
  await client.query(
    `insert into public.shops (id, slug, name, allow_delivery, is_delivery_enabled, shop_lat, shop_lng)
     values ($1, 'dup-shop', 'Dup Shop', true, true, 13.7563, 100.5018)`,
    [ids.shop]
  );
  await client.query(
    `insert into public.riders (id, shop_id, auth_user_id, display_name, phone, status)
     values ($1, $2, $3, 'Dup Rider A', '0990000021', 'active'),
            ($4, $2, $5, 'Dup Rider B', '0990000022', 'active')`,
    [ids.riderA, ids.shop, ids.userA, ids.riderB, ids.userB]
  );
  for (const [orderId, no] of [
    [ids.order1, 'DUP-001'],
    [ids.order2, 'DUP-002'],
    [ids.order3, 'DUP-003'],
  ]) {
    await client.query(
      `insert into public.orders (
         id, shop_id, order_no, type, subtotal, total,
         delivery_address, delivery_lat, delivery_lng, dispatch_status, status
       ) values ($1, $2, $3, 'delivery', 100, 100, 'ปลายทาง', 13.7564, 100.5018, 'pending', 'served')`,
      [orderId, ids.shop, no]
    );
  }
  // ไรเดอร์ต้องมี session เปิดอยู่ถึงจะรับงานได้
  for (const riderId of [ids.riderA, ids.riderB]) {
    await client.query(
      `insert into public.rider_work_sessions (rider_id, shop_id, started_at, status)
       values ($1, $2, now(), 'open')`,
      [riderId, ids.shop]
    );
  }
}

async function offer(client, orderId, riderId, status = 'offered') {
  const id = nextOfferId();
  await client.query(
    `insert into public.dispatch_offers (id, order_id, rider_id, shop_id, status, offered_at, timeout_at)
     values ($1, $2, $3, $4, $5, now(), now() + interval '2 minutes')`,
    [id, orderId, riderId, ids.shop, status]
  );
  return id;
}

const respond = (client, offerId, action) =>
  client.query('select public.respond_to_dispatch_offer($1, $2) as r', [offerId, action]);

const orderRow = async (client, orderId) =>
  (
    await client.query(
      'select dispatch_status, assigned_rider_id from public.orders where id = $1',
      [orderId]
    )
  ).rows[0];

async function run() {
  const admin = await connect();

  try {
    await seedFixtures(admin);

    // --- ออเดอร์เดียวมี offer ที่ยัง offered ได้ใบเดียว ----------------------
    await offer(admin, ids.order1, ids.riderA);
    await expectError(
      () => offer(admin, ids.order1, ids.riderB),
      'uq_dispatch_offers_one_active_per_order|duplicate key'
    );
    console.log('[PASS] ออเดอร์เดียวมี offer ที่ยังรอตอบได้ใบเดียว ฐานข้อมูลกันให้');

    const activeOffers = (
      await admin.query(
        "select count(*)::int as n from public.dispatch_offers where order_id = $1 and status = 'offered'",
        [ids.order1]
      )
    ).rows[0].n;
    assert.equal(activeOffers, 1);
    console.log('[PASS] เหลือ offer ที่รอตอบใบเดียวจริง');

    // --- ตอบ offer เดิมซ้ำไม่ได้ --------------------------------------------
    const offer1 = (
      await admin.query(
        "select id from public.dispatch_offers where order_id = $1 and status = 'offered'",
        [ids.order1]
      )
    ).rows[0].id;

    await asRider(admin, ids.userA, () => respond(admin, offer1, 'accept'));
    let row = await orderRow(admin, ids.order1);
    assert.equal(row.dispatch_status, 'assigned');
    assert.equal(row.assigned_rider_id, ids.riderA);
    console.log('[PASS] รับงานสำเร็จ ออเดอร์ถูกผูกกับไรเดอร์');

    await expectError(
      () => asRider(admin, ids.userA, () => respond(admin, offer1, 'accept')),
      'OFFER_ALREADY_RESPONDED'
    );
    row = await orderRow(admin, ids.order1);
    assert.equal(row.assigned_rider_id, ids.riderA, 'กดรับซ้ำต้องไม่เปลี่ยนเจ้าของงาน');
    console.log('[PASS] กดรับ offer เดิมซ้ำถูกปฏิเสธ เจ้าของงานไม่เปลี่ยน');

    // --- ไรเดอร์คนที่สองรับออเดอร์ที่ถูกจองไปแล้วไม่ได้ ----------------------
    const lateOffer = await offer(admin, ids.order1, ids.riderB);
    await expectError(
      () => asRider(admin, ids.userB, () => respond(admin, lateOffer, 'accept')),
      'ORDER_ALREADY_ASSIGNED'
    );
    row = await orderRow(admin, ids.order1);
    assert.equal(row.assigned_rider_id, ids.riderA, 'ออเดอร์ต้องยังเป็นของคนแรก');
    console.log('[PASS] ไรเดอร์คนที่สองแย่งงานที่ถูกจองแล้วไม่ได้');

    // --- เพดานงานพร้อมกันของไรเดอร์คนเดียว ----------------------------------
    const second = await offer(admin, ids.order2, ids.riderA);
    await asRider(admin, ids.userA, () => respond(admin, second, 'accept'));
    console.log('[PASS] ไรเดอร์ถืองานที่สองได้');

    const third = await offer(admin, ids.order3, ids.riderA);
    await expectError(
      () => asRider(admin, ids.userA, () => respond(admin, third, 'accept')),
      'RIDER_CAPACITY_REACHED'
    );
    const order3Row = await orderRow(admin, ids.order3);
    assert.equal(order3Row.assigned_rider_id, null, 'งานที่เกินเพดานต้องไม่ถูกผูก');
    assert.equal(order3Row.dispatch_status, 'pending');
    console.log('[PASS] เกินเพดานงานพร้อมกันแล้วรับเพิ่มไม่ได้ และงานไม่ถูกผูก');

    // --- ไม่มีงานไหนถูกนับให้ไรเดอร์สองคนพร้อมกัน ---------------------------
    const doubleAssigned = (
      await admin.query(
        `select count(*)::int as n
           from public.orders
          where shop_id = $1
            and assigned_rider_id is not null
            and dispatch_status in ('assigned', 'in_transit')`,
        [ids.shop]
      )
    ).rows[0].n;
    assert.equal(doubleAssigned, 2, 'ต้องมีงานที่ถูกผูกสองใบพอดี ไม่มากไม่น้อย');

    const perOrder = (
      await admin.query(
        `select order_id, count(*)::int as n
           from public.dispatch_offers
          where status = 'accepted'
          group by order_id
         having count(*) > 1`
      )
    ).rows;
    assert.deepEqual(perOrder, [], 'ห้ามมีออเดอร์ใดมี offer ที่ accepted มากกว่าหนึ่งใบ');
    console.log('[PASS] ไม่มีออเดอร์ใดถูกรับซ้อนกันเกินหนึ่งครั้ง');
  } finally {
    try {
      await cleanFixtures(admin);
    } finally {
      await admin.end();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] Dispatch duplicate integration:', error.message);
  process.exitCode = 1;
});
