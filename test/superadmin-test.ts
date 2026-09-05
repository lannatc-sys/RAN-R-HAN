import fs from 'fs';
import path from 'path';
import {
  getPlatformStatsAction,
  getAllStoresAction,
  createStoreFromSuperadminAction,
  updateStoreStatusAction,
  updateStorePlanAction,
} from '../src/app/actions/superadmin';
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

async function runSuperadminTests() {
  console.log('========================================================');
  console.log('🛡️ Starting Superadmin SaaS System Tests (Supabase Live)');
  console.log('========================================================\n');

  // TEST 1: Platform Stats Action
  console.log('--- TEST 1: Testing getPlatformStatsAction ---');
  const statsRes = await getPlatformStatsAction();
  if (!statsRes.success || !statsRes.stats) {
    throw new Error(`TEST 1 Failed: ${statsRes.error}`);
  }
  console.log('   Total Stores:', statsRes.stats.totalStores);
  console.log('   Active Stores:', statsRes.stats.activeStores);
  console.log('   Platform GMV:', statsRes.stats.totalRevenue, 'THB');
  console.log('   Today Orders:', statsRes.stats.todayOrders, 'bills');
  if (statsRes.stats.totalStores < 1) {
    throw new Error('TEST 1 Failed: Expected at least 1 shop in DB');
  }
  console.log('   [PASS] Platform stats retrieved successfully! ✅\n');

  // TEST 2: Get All Stores & Live Search
  console.log('--- TEST 2: Testing getAllStoresAction & Search Filter ---');
  const allStoresRes = await getAllStoresAction();
  if (!allStoresRes.success || !allStoresRes.stores) {
    throw new Error(`TEST 2 Failed: ${allStoresRes.error}`);
  }
  console.log(`   Found ${allStoresRes.stores.length} total stores.`);

  const searchRes = await getAllStoresAction('คุณยาย');
  if (!searchRes.success || !searchRes.stores || searchRes.stores.length === 0) {
    throw new Error('TEST 2 Failed: Search query "คุณยาย" yielded 0 results!');
  }
  console.log(`   Search query "คุณยาย" found: "${searchRes.stores[0].name}"`);
  console.log('   [PASS] Stores directory & search verified! ✅\n');

  // TEST 3: Create Store From Superadmin
  console.log('--- TEST 3: Testing createStoreFromSuperadminAction ---');
  const testStoreName = `E2E SaaS Test Shop ${Date.now()}`;
  const createRes = await createStoreFromSuperadminAction({
    name: testStoreName,
    phone: '0899998888',
    plan: 'pro',
    promptpay_id: '0899998888',
    promptpay_name: 'Test Superadmin',
  });

  if (!createRes.success || !createRes.shopId) {
    throw new Error(`TEST 3 Failed: ${createRes.error}`);
  }
  const createdShopId = createRes.shopId;
  console.log(`   Created new store ID: ${createdShopId} ("${testStoreName}")`);
  console.log('   [PASS] New store created via Superadmin! ✅\n');

  try {
    // TEST 4: Update Store Status (Suspend & Reactivate)
    console.log('--- TEST 4: Testing updateStoreStatusAction ---');
    console.log('   Suspending store...');
    const suspendRes = await updateStoreStatusAction(createdShopId, 'suspended');
    if (!suspendRes.success) throw new Error(`Suspend failed: ${suspendRes.error}`);

    const { data: suspendedShop } = await admin.from('shops').select('status, is_active').eq('id', createdShopId).single();
    if (suspendedShop?.status !== 'suspended' || suspendedShop?.is_active !== false) {
      throw new Error(`TEST 4 Failed: Expected suspended status and is_active false, got: ${JSON.stringify(suspendedShop)}`);
    }
    console.log('   Store suspended successfully.');

    console.log('   Reactivating store...');
    const reactivateRes = await updateStoreStatusAction(createdShopId, 'active');
    if (!reactivateRes.success) throw new Error(`Reactivate failed: ${reactivateRes.error}`);

    const { data: activeShop } = await admin.from('shops').select('status, is_active').eq('id', createdShopId).single();
    if (activeShop?.status !== 'active' || activeShop?.is_active !== true) {
      throw new Error(`TEST 4 Failed: Expected active status and is_active true, got: ${JSON.stringify(activeShop)}`);
    }
    console.log('   [PASS] Store suspension and reactivation verified! ✅\n');

    // TEST 5: Update Store Plan
    console.log('--- TEST 5: Testing updateStorePlanAction ---');
    const planRes = await updateStorePlanAction(createdShopId, 'enterprise');
    if (!planRes.success) throw new Error(`Plan update failed: ${planRes.error}`);

    const { data: updatedPlanShop } = await admin.from('shops').select('plan').eq('id', createdShopId).single();
    if (updatedPlanShop?.plan !== 'enterprise') {
      throw new Error(`TEST 5 Failed: Expected plan 'enterprise', got '${updatedPlanShop?.plan}'`);
    }
    console.log('   [PASS] Store plan updated to "enterprise" successfully! ✅\n');
  } finally {
    // CLEANUP TEST STORE
    console.log('🧹 Cleaning up test store...');
    await admin.from('categories').delete().eq('shop_id', createdShopId);
    await admin.from('shops').delete().eq('id', createdShopId);
    console.log('   Cleanup completed.\n');
  }

  console.log('========================================================');
  console.log('🎉 ALL SUPERADMIN TESTS PASSED SUCCESSFULLY! (5/5 PASS)');
  console.log('========================================================');
}

runSuperadminTests().catch((err) => {
  console.error('\n❌ SUPERADMIN TEST FAILED:', err);
  process.exit(1);
});
