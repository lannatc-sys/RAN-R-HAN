import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. โหลด Environment Variables จาก .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runE2ETests() {
  console.log('========================================================');
  console.log('🚀 Starting End-to-End Test Suite for Rab-R-HAN (Supabase)');
  console.log('========================================================\n');

  // ดึงร้านค้าและเมนูตัวอย่าง
  const { data: shop, error: shopErr } = await admin.from('shops').select('*').limit(1).single();
  if (shopErr || !shop) {
    throw new Error(`Failed to fetch test shop: ${shopErr?.message}`);
  }
  console.log(`📍 Test Shop: "${shop.name}" (ID: ${shop.id})`);
  console.log(`🔒 KDS PIN configured: ${shop.kds_pin || '0000'}\n`);

  const { data: menuItem, error: menuErr } = await admin
    .from('menu_items')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('is_available', true)
    .limit(1)
    .single();

  if (menuErr || !menuItem) {
    throw new Error(`Failed to fetch test menu item: ${menuErr?.message}`);
  }
  console.log(`🍲 Test Menu Item: "${menuItem.name}" (Price: ${menuItem.price} THB)\n`);

  const originalPrice = Number(menuItem.price);
  const transRefTest = `E2E_SLIP_${Date.now()}`;

  // ----------------------------------------------------
  // TEST 1: Smoke test (PromptPay Flow + Webhook Auto-Confirm)
  // ----------------------------------------------------
  console.log('--- TEST 1: Smoke test (PromptPay Flow + Webhook Confirmation) ---');
  const { data: promptPayOrder, error: createErr1 } = await admin.rpc('create_pickup_order', {
    p_shop_id: shop.id,
    p_customer_phone: '0891234567',
    p_source: 'customer',
    p_items: [{ menu_item_id: menuItem.id, qty: 1, option_ids: [] }],
  });

  if (createErr1 || !promptPayOrder) {
    throw new Error(`TEST 1 Failed: create_pickup_order error: ${createErr1?.message}`);
  }
  const orderId1 = promptPayOrder.order_id;
  console.log(`   Created Order #${promptPayOrder.order_no} (ID: ${orderId1}, Total: ${promptPayOrder.total} THB)`);

  // ตรวจสอบสถานะเริ่มต้นต้องเป็น pending
  const { data: initialOrder1 } = await admin.from('orders').select('status').eq('id', orderId1).single();
  if (initialOrder1?.status !== 'pending') {
    throw new Error(`TEST 1 Failed: Expected initial status 'pending', got '${initialOrder1?.status}'`);
  }

  // จำลอง Webhook เรียก verify_and_confirm_payment RPC
  const { data: verifyResult, error: verifyErr } = await admin.rpc('verify_and_confirm_payment', {
    p_order_id: orderId1,
    p_amount: Number(promptPayOrder.total),
    p_trans_ref: transRefTest,
    p_raw_payload: { simulated: true, e2e: true, transRef: transRefTest },
  });

  if (verifyErr || !verifyResult?.success) {
    throw new Error(`TEST 1 Failed: verify_and_confirm_payment error: ${verifyErr?.message}`);
  }

  // ตรวจสอบว่าออเดอร์เปลี่ยนสถานะเป็น confirmed และ payment เป็น verified
  const { data: confirmedOrder1 } = await admin
    .from('orders')
    .select('*, payments(*)')
    .eq('id', orderId1)
    .single();

  if (confirmedOrder1?.status !== 'confirmed') {
    throw new Error(`TEST 1 Failed: Order status is not 'confirmed', got '${confirmedOrder1?.status}'`);
  }

  const verifiedPayment1 = confirmedOrder1.payments.find((p: any) => p.trans_ref === transRefTest);
  if (!verifiedPayment1 || verifiedPayment1.status !== 'verified') {
    throw new Error(`TEST 1 Failed: Payment status is not 'verified'`);
  }
  console.log('   [PASS] PromptPay order confirmed & payment verified successfully! ✅\n');

  // ----------------------------------------------------
  // TEST 2: Smoke test (Cash Payment Flow + Staff Confirmation)
  // ----------------------------------------------------
  console.log('--- TEST 2: Smoke test (Cash Flow + Staff Cash Confirm) ---');
  const { data: cashOrder, error: createErr2 } = await admin.rpc('create_pickup_order', {
    p_shop_id: shop.id,
    p_customer_phone: '0812345678',
    p_source: 'customer',
    p_items: [{ menu_item_id: menuItem.id, qty: 2, option_ids: [] }],
  });

  if (createErr2 || !cashOrder) {
    throw new Error(`TEST 2 Failed: create_pickup_order error: ${createErr2?.message}`);
  }
  const orderId2 = cashOrder.order_id;
  console.log(`   Created Cash Order #${cashOrder.order_no} (ID: ${orderId2}, Total: ${cashOrder.total} THB)`);

  // สร้าง Cash payment record ในสถานะ pending
  await admin.from('payments').insert({
    order_id: orderId2,
    method: 'cash',
    amount: Number(cashOrder.total),
    status: 'pending',
  });

  // พนักงานกดปุ่ม "ยืนยันรับเงินสดแล้ว"
  const { error: cashPayErr } = await admin
    .from('payments')
    .update({ status: 'verified', verified_at: new Date().toISOString() })
    .eq('order_id', orderId2)
    .eq('method', 'cash');

  if (cashPayErr) {
    throw new Error(`TEST 2 Failed: Failed to verify cash payment: ${cashPayErr.message}`);
  }

  // อัปเดตสถานะออเดอร์เป็น confirmed
  await admin.from('orders').update({ status: 'confirmed' }).eq('id', orderId2);

  const { data: verifiedCashOrder } = await admin
    .from('orders')
    .select('*, payments(*)')
    .eq('id', orderId2)
    .single();

  if (verifiedCashOrder?.status !== 'confirmed') {
    throw new Error(`TEST 2 Failed: Cash order status not confirmed`);
  }
  const cashPayment = verifiedCashOrder.payments.find((p: any) => p.method === 'cash');
  if (cashPayment?.status !== 'verified') {
    throw new Error(`TEST 2 Failed: Cash payment status not verified`);
  }
  console.log('   [PASS] Cash order verified & confirmed by staff successfully! ✅\n');

  // ----------------------------------------------------
  // TEST 3: Smoke test (Price Isolation Snapshot)
  // ----------------------------------------------------
  console.log('--- TEST 3: Smoke test (Price Snapshot Isolation) ---');
  const expectedOrderPrice = originalPrice;

  // 1. สร้างออเดอร์ด้วยราคาปัจจุบัน
  const { data: snapshotOrder, error: snapCreateErr } = await admin.rpc('create_pickup_order', {
    p_shop_id: shop.id,
    p_customer_phone: '0855555555',
    p_source: 'customer',
    p_items: [{ menu_item_id: menuItem.id, qty: 1, option_ids: [] }],
  });

  if (snapCreateErr || !snapshotOrder) {
    throw new Error(`TEST 3 Failed: ${snapCreateErr?.message}`);
  }
  const orderId3 = snapshotOrder.order_id;
  console.log(`   Order created at original price: ${expectedOrderPrice} THB`);

  try {
    // 2. แอดมินเข้าไปแก้ราคาเมนูให้แพงขึ้นเป็น 999.00 THB ในตาราง menu_items
    console.log('   Simulating menu price change in database: 999.00 THB...');
    await admin.from('menu_items').update({ price: 999.0 }).eq('id', menuItem.id);

    // 3. ดึงข้อมูลออเดอร์เก่าที่สร้างไว้กลับมาตรวจสอบ
    const { data: oldOrder } = await admin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId3)
      .single();

    const orderItem = oldOrder?.order_items?.[0];
    const snapshotItemPrice = Number(orderItem?.price_snapshot);
    const orderTotal = Number(oldOrder?.total);

    console.log(`   Old order line price snapshot: ${snapshotItemPrice} THB`);
    console.log(`   Old order grand total: ${orderTotal} THB`);

    if (snapshotItemPrice !== expectedOrderPrice || orderTotal !== expectedOrderPrice) {
      throw new Error(
        `TEST 3 Failed: Price isolation breached! Expected ${expectedOrderPrice} THB, but got item: ${snapshotItemPrice}, total: ${orderTotal}`
      );
    }
    console.log('   [PASS] Price isolation confirmed! Bill remains completely isolated from menu price changes. ✅\n');
  } finally {
    // คืนค่าราคาเดิมของเมนู
    await admin.from('menu_items').update({ price: originalPrice }).eq('id', menuItem.id);
  }

  // ----------------------------------------------------
  // TEST 4: Security test (Duplicate Slip trans_ref Rejection via 23505)
  // ----------------------------------------------------
  console.log('--- TEST 4: Security test (Duplicate Slip trans_ref Rejection) ---');
  // สร้างออเดอร์ใหม่อีกใบ
  const { data: dupTargetOrder } = await admin.rpc('create_pickup_order', {
    p_shop_id: shop.id,
    p_customer_phone: '0877777777',
    p_source: 'customer',
    p_items: [{ menu_item_id: menuItem.id, qty: 1, option_ids: [] }],
  });

  const orderId4 = dupTargetOrder.order_id;
  console.log(`   Created new Order #${dupTargetOrder.order_no} (ID: ${orderId4})`);
  console.log(`   Attempting to reuse previous transRef: "${transRefTest}"...`);

  // ยิง verify_and_confirm_payment ซ้ำด้วย transRefTest เดิม
  const { data: dupResult, error: dupErr } = await admin.rpc('verify_and_confirm_payment', {
    p_order_id: orderId4,
    p_amount: Number(dupTargetOrder.total),
    p_trans_ref: transRefTest, // สลิปเดิมจาก Test 1!
    p_raw_payload: { simulated: true, e2e: true, transRef: transRefTest },
  });

  if (!dupErr) {
    throw new Error('TEST 4 Failed: Reused slip was unexpectedly accepted without error!');
  }

  console.log(`   PostgreSQL Error Code: "${dupErr.code}" | Message: "${dupErr.message}"`);
  if (dupErr.code !== '23505') {
    throw new Error(`TEST 4 Failed: Expected PostgreSQL code '23505' (unique violation), got '${dupErr.code}'`);
  }

  // ตรวจสอบว่าออเดอร์ใบที่ 4 ไม่ถูกเปลี่ยนสถานะเป็น confirmed
  const { data: untouchedOrder4 } = await admin.from('orders').select('status').eq('id', orderId4).single();
  if (untouchedOrder4?.status !== 'pending') {
    throw new Error(`TEST 4 Failed: Order 4 status was changed despite duplicate slip error!`);
  }
  console.log('   [PASS] Duplicate slip was rejected with PostgreSQL code 23505! ✅\n');

  // ทำความสะอาดข้อมูลทดสอบ
  console.log('🧹 Cleaning up test data...');
  await admin.from('payments').delete().in('order_id', [orderId1, orderId2, orderId3, orderId4]);
  await admin.from('order_items').delete().in('order_id', [orderId1, orderId2, orderId3, orderId4]);
  await admin.from('orders').delete().in('id', [orderId1, orderId2, orderId3, orderId4]);
  console.log('   Test cleanup completed.\n');

  console.log('========================================================');
  console.log('🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY! (4/4 PASS)');
  console.log('========================================================');
}

runE2ETests().catch((err) => {
  console.error('\n❌ E2E TEST SUITE FAILED:', err);
  process.exit(1);
});
