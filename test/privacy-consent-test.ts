import fs from 'fs';
import path from 'path';

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

import { createAdminClient } from '../src/lib/supabase/admin';
import { getPlatformStatsAction, getAllStoresAction } from '../src/app/actions/superadmin';
import { grantSupportAccessAction, revokeSupportAccessAction } from '../src/app/actions/settings';

async function runPrivacyConsentTest() {
  console.log('====================================================');
  console.log('🧪 Starting Privacy First & Consent-based Support Access Test');
  console.log('====================================================\n');

  const admin = createAdminClient();

  // Pick a shop for testing
  const { data: shops, error: shopErr } = await admin.from('shops').select('id, name, slug').limit(1);
  if (shopErr || !shops || shops.length === 0) {
    throw new Error('No shops found to run test');
  }
  const testShop = shops[0];
  console.log(`📍 Using test shop: "${testShop.name}" (${testShop.id})\n`);

  // --- TEST 1: Privacy First - Platform Stats ---
  console.log('--- TEST 1: Verifying Platform Stats Privacy First (No GMV/Revenue) ---');
  const statsRes = await getPlatformStatsAction();
  if (!statsRes.success || !statsRes.stats) {
    throw new Error(`TEST 1 Failed: ${statsRes.error}`);
  }
  const statsKeys = Object.keys(statsRes.stats);
  console.log('   Returned Stats keys:', statsKeys.join(', '));
  if ('totalRevenue' in statsRes.stats || 'todayRevenue' in statsRes.stats) {
    throw new Error('TEST 1 Failed: PlatformStats still contains financial revenue fields!');
  }
  console.log('   Total Orders:', statsRes.stats.totalOrders);
  console.log('   Today Orders:', statsRes.stats.todayOrders);
  console.log('   [PASS] Platform stats contains NO revenue/GMV fields! ✅\n');

  // --- TEST 2: Privacy First - All Stores Directory ---
  console.log('--- TEST 2: Verifying All Stores Directory Privacy First ---');
  const storesRes = await getAllStoresAction();
  if (!storesRes.success || !storesRes.stores || storesRes.stores.length === 0) {
    throw new Error(`TEST 2 Failed: ${storesRes.error}`);
  }
  const sampleStore = storesRes.stores[0];
  console.log('   Store keys count:', Object.keys(sampleStore).length);
  if ('revenue' in sampleStore) {
    throw new Error('TEST 2 Failed: Stores directory still exposes revenue!');
  }
  if (!('order_count' in sampleStore)) {
    throw new Error('TEST 2 Failed: Stores directory missing order_count!');
  }
  console.log(`   Sample store "${sampleStore.name}" has order_count: ${sampleStore.order_count}, revenue: undefined`);
  console.log('   [PASS] All Stores Directory strictly omits revenue and keeps order_count! ✅\n');

  // --- TEST 3: Grant Support Access (24 Hours) ---
  console.log('--- TEST 3: Granting Support Access (24 hours) ---');
  const grant24Res = await grantSupportAccessAction(testShop.id, 24);
  if (!grant24Res.success || !grant24Res.expiresAt) {
    throw new Error(`TEST 3 Failed: ${grant24Res.error}`);
  }
  console.log('   Granted expiresAt:', grant24Res.expiresAt);

  // Check DB directly
  const { data: dbShop24 } = await admin
    .from('shops')
    .select('id, support_access_expires_at')
    .eq('id', testShop.id)
    .single();

  if (!dbShop24?.support_access_expires_at) {
    throw new Error('TEST 3 Failed: DB does not have support_access_expires_at set');
  }
  const expires24 = new Date(dbShop24.support_access_expires_at);
  const diffHours24 = (expires24.getTime() - Date.now()) / (1000 * 60 * 60);
  console.log(`   DB support_access_expires_at: ${expires24.toISOString()} (~${diffHours24.toFixed(1)} hrs remaining)`);
  if (diffHours24 < 23 || diffHours24 > 25) {
    throw new Error(`TEST 3 Failed: Expected ~24h, got ${diffHours24}`);
  }
  console.log('   [PASS] Support Access 24h granted and verified in Database! ✅\n');

  // --- TEST 4: Grant Support Access (48 Hours) ---
  console.log('--- TEST 4: Granting Support Access (48 hours) ---');
  const grant48Res = await grantSupportAccessAction(testShop.id, 48);
  if (!grant48Res.success || !grant48Res.expiresAt) {
    throw new Error(`TEST 4 Failed: ${grant48Res.error}`);
  }

  const { data: dbShop48 } = await admin
    .from('shops')
    .select('id, support_access_expires_at')
    .eq('id', testShop.id)
    .single();

  const expires48 = new Date(dbShop48?.support_access_expires_at || '');
  const diffHours48 = (expires48.getTime() - Date.now()) / (1000 * 60 * 60);
  console.log(`   DB support_access_expires_at: ${expires48.toISOString()} (~${diffHours48.toFixed(1)} hrs remaining)`);
  if (diffHours48 < 47 || diffHours48 > 49) {
    throw new Error(`TEST 4 Failed: Expected ~48h, got ${diffHours48}`);
  }
  console.log('   [PASS] Support Access 48h updated and verified in Database! ✅\n');

  // --- TEST 5: Revoke Support Access ---
  console.log('--- TEST 5: Revoking Support Access (Immediate) ---');
  const revokeRes = await revokeSupportAccessAction(testShop.id);
  if (!revokeRes.success) {
    throw new Error(`TEST 5 Failed: ${revokeRes.error}`);
  }

  const { data: dbShopRevoked } = await admin
    .from('shops')
    .select('id, support_access_expires_at')
    .eq('id', testShop.id)
    .single();

  if (dbShopRevoked?.support_access_expires_at !== null) {
    throw new Error(`TEST 5 Failed: Expected null support_access_expires_at, got ${dbShopRevoked?.support_access_expires_at}`);
  }
  console.log('   DB support_access_expires_at is now: NULL');
  console.log('   [PASS] Support Access revoked successfully! ✅\n');

  console.log('====================================================');
  console.log('🎉 ALL PRIVACY & SUPPORT ACCESS TESTS PASSED! 🎉');
  console.log('====================================================\n');
}

runPrivacyConsentTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
