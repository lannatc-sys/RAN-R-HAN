/**
 * ค่ารอบและรายได้ไรเดอร์ — integration test กับ PostgreSQL จริง
 *
 *   TEST_DATABASE_URL=postgres://... node test/settlement-payout.integration.cjs
 *
 * เรียก RPC create_daily_settlement_draft ตัวจริงแล้วอ่านสิ่งที่มันเขียนลง
 * settlement_line_items ไม่เขียน query เลียนแบบเงื่อนไขของมันในเทส
 * เพราะนั่นเท่ากับทดสอบ SQL ที่เทสเขียนเอง ไม่ใช่โค้ดที่ production ใช้
 *
 * เทสนี้ไม่ตัดสินว่าอัตราจ่ายควรเป็นเท่าไร ตรวจแค่ว่าอัตราที่ระบบใช้อยู่ตอนนี้
 * ถูก snapshot ต่อออเดอร์ นับครบ นับครั้งเดียว และไม่ขยับตามการตั้งค่าใหม่
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
  shop: '70000000-0000-4000-8000-000000000001',
  user: '71000000-0000-4000-8000-000000000001',
  rider: '72000000-0000-4000-8000-000000000001',
};

let orderSeq = 0;
const nextOrderId = () =>
  '73000000-0000-4000-8000-0000000000' + String(++orderSeq).padStart(2, '0');

async function connect() {
  const client = new Client({
    connectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set statement_timeout = '10s'");
  return client;
}

async function cleanFixtures(client) {
  await client.query('reset role');
  await client.query(
    'delete from public.settlement_line_items where shop_id = $1',
    [ids.shop]
  );
  await client.query('delete from public.daily_settlements where shop_id = $1', [ids.shop]);
  await client.query(
    'delete from public.delivery_events where order_id in (select id from public.orders where shop_id = $1)',
    [ids.shop]
  );
  await client.query('delete from public.orders where shop_id = $1', [ids.shop]);
  await client.query('delete from public.riders where shop_id = $1', [ids.shop]);
  await client.query('delete from public.shops where id = $1', [ids.shop]);
  await client.query('delete from auth.users where id = $1', [ids.user]);
}

async function seedFixtures(client) {
  await cleanFixtures(client);
  await client.query(`insert into auth.users (id, email) values ($1, 'payout@example.invalid')`, [
    ids.user,
  ]);
  await client.query(
    `insert into public.shops (id, slug, name, allow_delivery, is_delivery_enabled, delivery_base_fee)
     values ($1, 'payout-shop', 'Payout Shop', true, true, 30)`,
    [ids.shop]
  );
  await client.query(
    `insert into public.riders (id, shop_id, auth_user_id, display_name, phone, status)
     values ($1, $2, $3, 'Payout Rider', '0990000031', 'active')`,
    [ids.rider, ids.shop, ids.user]
  );
}

async function makeOrder(
  client,
  { dispatchStatus, status = 'served', deliveryFee = 30, assigned = true, distanceKm = 3 }
) {
  const id = nextOrderId();
  await client.query(
    `insert into public.orders (
       id, shop_id, order_no, type, subtotal, total, delivery_fee, estimated_distance_km,
       delivery_address, delivery_lat, delivery_lng,
       assigned_rider_id, dispatch_status, status
     ) values ($1, $2, $3, 'delivery', 100, 100, $4, $5, 'ปลายทาง', 13.7564, 100.5018, $6, $7, $8)`,
    [
      id,
      ids.shop,
      'PAY-' + orderSeq,
      deliveryFee,
      distanceKm,
      assigned ? ids.rider : null,
      dispatchStatus,
      status,
    ]
  );
  return id;
}

/** ค่ารอบจัดกลุ่มตามเวลาของ event ที่ส่งถึง ไม่ใช่ updated_at ของออเดอร์ */
async function markDeliveredEvent(client, orderId) {
  await client.query(
    `insert into public.delivery_events (order_id, rider_id, shop_id, event_type, server_received_at)
     values ($1, $2, $3, 'delivered', now())`,
    [orderId, ids.rider, ids.shop]
  );
}

const draftSettlement = async (client, date) =>
  (
    await client.query('select public.create_daily_settlement_draft($1, $2::date) as id', [
      ids.shop,
      date,
    ])
  ).rows[0].id;

const lineItems = async (client, settlementId) =>
  (
    await client.query(
      `select order_id,
              delivery_fee::numeric as delivery_fee,
              shop_portion::numeric as shop_portion,
              rider_payout::numeric as rider_payout,
              rider_pool_amount::numeric as rider_pool_amount,
              flags
         from public.settlement_line_items
        where settlement_id = $1`,
      [settlementId]
    )
  ).rows;

async function run() {
  const admin = await connect();

  try {
    await seedFixtures(admin);
    const today = (
      await admin.query("select (now() at time zone 'Asia/Bangkok')::date as d")
    ).rows[0].d;

    // --- งานที่ยังไม่ส่งถึงและงานที่ล้มเหลวต้องไม่เข้าค่ารอบ -------------------
    await makeOrder(admin, { dispatchStatus: 'pending' });
    await makeOrder(admin, { dispatchStatus: 'assigned' });
    await makeOrder(admin, { dispatchStatus: 'in_transit' });
    const failed = await makeOrder(admin, { dispatchStatus: 'failed', status: 'cancelled' });
    await markDeliveredEvent(admin, failed); // มี event แต่สถานะไม่ใช่ delivered

    let settlementId = await draftSettlement(admin, today);
    let items = await lineItems(admin, settlementId);
    assert.equal(items.length, 0, 'งานที่ยังไม่ส่งถึงหรือล้มเหลวต้องไม่เข้าค่ารอบ');
    console.log('[PASS] pending/assigned/in_transit/failed ไม่เข้าค่ารอบ');

    // --- งานที่ส่งถึงแล้วเข้าค่ารอบพร้อม snapshot ต่อออเดอร์ -------------------
    await admin.query('delete from public.daily_settlements where shop_id = $1', [ids.shop]);
    const delivered = await makeOrder(admin, {
      dispatchStatus: 'delivered',
      status: 'completed',
      deliveryFee: 30,
    });
    await markDeliveredEvent(admin, delivered);

    settlementId = await draftSettlement(admin, today);
    items = await lineItems(admin, settlementId);
    assert.equal(items.length, 1, 'งานที่ส่งถึงแล้วต้องเข้าค่ารอบ');

    const line = items[0];
    assert.equal(line.order_id, delivered);
    assert.equal(Number(line.delivery_fee), 30, 'ค่าส่งต้องมาจากค่าที่ snapshot ไว้บนออเดอร์');
    console.log('[PASS] งานที่ส่งถึงแล้วเข้าค่ารอบ พร้อมค่าส่งที่ snapshot ไว้');

    // --- payout ถูกบันทึกเป็น snapshot ต่อออเดอร์ ไม่ใช่คำนวณสดตอนอ่าน --------
    const payoutAtDraft = Number(line.rider_payout);
    const poolAtDraft = Number(line.rider_pool_amount);
    assert.ok(payoutAtDraft > 0, 'ต้องมีค่าตอบแทนไรเดอร์บันทึกไว้ต่อออเดอร์');
    assert.equal(
      poolAtDraft,
      Number(line.delivery_fee) + Number(line.shop_portion) - payoutAtDraft,
      'ส่วนที่เหลือเข้ากองกลางต้องสมดุลกับค่าส่งและส่วนที่ร้านออก'
    );
    console.log('[PASS] ค่าตอบแทนถูก snapshot ต่อออเดอร์ และยอดสมดุล');

    // --- ร้านเปลี่ยนค่าส่งภายหลัง บรรทัดที่บันทึกไว้ต้องไม่ขยับ ---------------
    await admin.query('update public.shops set delivery_base_fee = 99 where id = $1', [ids.shop]);
    const afterRateChange = (await lineItems(admin, settlementId))[0];
    assert.equal(
      Number(afterRateChange.delivery_fee),
      30,
      'ค่าส่งในค่ารอบที่ออกไปแล้วต้องไม่ขยับตามการตั้งค่าใหม่'
    );
    assert.equal(Number(afterRateChange.rider_payout), payoutAtDraft, 'ค่าตอบแทนที่บันทึกไว้ต้องไม่ขยับ');
    console.log('[PASS] เปลี่ยนค่าส่งของร้านแล้วค่ารอบที่ออกไปแล้วไม่ขยับ');

    // --- เรียกซ้ำวันเดิมต้องไม่สร้างใบใหม่และไม่นับงานซ้ำ ---------------------
    const again = await draftSettlement(admin, today);
    assert.equal(again, settlementId, 'เรียกซ้ำวันเดิมต้องได้ใบเดิม');

    const itemsAfterRerun = await lineItems(admin, settlementId);
    assert.equal(itemsAfterRerun.length, 1, 'เรียกซ้ำต้องไม่เพิ่มบรรทัดซ้ำ');

    const settlementCount = (
      await admin.query(
        'select count(*)::int as n from public.daily_settlements where shop_id = $1 and settlement_date = $2::date',
        [ids.shop, today]
      )
    ).rows[0].n;
    assert.equal(settlementCount, 1, 'ต้องมีใบค่ารอบของวันนั้นใบเดียว');
    console.log('[PASS] เรียกซ้ำวันเดิมได้ใบเดิม ไม่เกิดบรรทัดซ้ำและไม่เกิดใบซ้ำ');

    // --- งานที่ไม่มีไรเดอร์ถูกติดธงไว้ ไม่ถูกจ่ายเงียบ ๆ ----------------------
    await admin.query('delete from public.settlement_line_items where shop_id = $1', [ids.shop]);
    await admin.query('delete from public.daily_settlements where shop_id = $1', [ids.shop]);

    const orphan = await makeOrder(admin, {
      dispatchStatus: 'delivered',
      status: 'completed',
      assigned: false,
    });
    await admin.query(
      `insert into public.delivery_events (order_id, rider_id, shop_id, event_type, server_received_at)
       values ($1, $2, $3, 'delivered', now())`,
      [orphan, ids.rider, ids.shop]
    );

    settlementId = await draftSettlement(admin, today);
    const withOrphan = await lineItems(admin, settlementId);
    const orphanLine = withOrphan.find((r) => r.order_id === orphan);
    assert.ok(orphanLine, 'งานที่ส่งถึงแล้วต้องเข้าค่ารอบแม้ยังไม่ผูกไรเดอร์');
    assert.ok(
      orphanLine.flags.includes('PENDING_RIDER'),
      'งานที่ไม่มีไรเดอร์ต้องถูกติดธงไว้ให้คนตรวจ ไม่ใช่จ่ายเงียบ ๆ'
    );
    console.log('[PASS] งานที่ยังไม่ผูกไรเดอร์ถูกติดธง PENDING_RIDER');

    // --- ระยะเกินเพดานที่ยังไม่มี rate card ต้องถูกติดธง ---------------------
    await admin.query('delete from public.settlement_line_items where shop_id = $1', [ids.shop]);
    await admin.query('delete from public.daily_settlements where shop_id = $1', [ids.shop]);

    const far = await makeOrder(admin, {
      dispatchStatus: 'delivered',
      status: 'completed',
      distanceKm: 12,
    });
    await markDeliveredEvent(admin, far);

    settlementId = await draftSettlement(admin, today);
    const farLine = (await lineItems(admin, settlementId)).find((r) => r.order_id === far);
    assert.ok(farLine, 'งานระยะไกลต้องยังเข้าค่ารอบ');
    assert.ok(
      farLine.flags.includes('PENDING_RATE_CARD'),
      'ระยะเกินเพดานต้องถูกติดธงรอ rate card ไม่ใช่จ่ายตามอัตราฐานเงียบ ๆ'
    );
    console.log('[PASS] ระยะเกินเพดานถูกติดธง PENDING_RATE_CARD');
  } finally {
    try {
      await cleanFixtures(admin);
    } finally {
      await admin.end();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] Settlement payout integration:', error.message);
  process.exitCode = 1;
});
