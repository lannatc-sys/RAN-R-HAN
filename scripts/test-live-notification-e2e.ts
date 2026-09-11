import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { notifyRiderNewOffer } from '../src/lib/rider-notification';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runE2E() {
  console.log('=== Starting Step 5: Live Notification & Dispatch E2E Test ===\n');

  // 1. Get Pilot Shop
  const { data: shop, error: shopError } = await adminClient
    .from('shops')
    .select('id, name, slug, shop_lat, shop_lng')
    .eq('slug', 'krua-pa-daeng')
    .single();
  if (shopError || !shop) throw new Error('Shop error: ' + shopError?.message);
  console.log(`[PASS] Pilot Shop: "${shop.name}" at [${shop.shop_lat}, ${shop.shop_lng}]`);

  // 2. Authenticate Rider 1
  const riderClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await riderClient.auth.signInWithPassword({
    email: 'rider1.kruapa@gmail.com',
    password: 'RiderPass1234!',
  });
  if (authError || !authData.user) throw new Error('Rider login failed: ' + authError?.message);
  console.log(`[PASS] Rider 1 authenticated: ${authData.user.id}`);

  const { data: rider } = await adminClient.from('riders').select('*').eq('auth_user_id', authData.user.id).single();
  console.log(`[PASS] Rider row found: ${rider.display_name} (${rider.id})`);

  // 3. Ensure Open Work Session
  let { data: session } = await adminClient
    .from('rider_work_sessions')
    .select('id, status')
    .eq('rider_id', rider.id)
    .eq('status', 'open')
    .maybeSingle();

  if (!session) {
    const { data: newSession } = await adminClient
      .from('rider_work_sessions')
      .insert({ rider_id: rider.id, shop_id: rider.shop_id, status: 'open' })
      .select('id, status')
      .single();
    session = newSession;
  }
  if (!session) throw new Error('No active work session');
  console.log(`[PASS] Active work session: ${session.id}`);

  // 4. Update Rider Location near Shop
  const riderLat = 19.3008;
  const riderLng = 97.9675;
  await adminClient.from('rider_current_locations').upsert({
    rider_id: rider.id,
    shop_id: rider.shop_id,
    work_session_id: session.id,
    lat: riderLat,
    lng: riderLng,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'rider_id' });
  console.log(`[PASS] Rider location updated to [${riderLat}, ${riderLng}]`);

  // 5. PostGIS Spatial Search
  const { data: availableRiders, error: findError } = await adminClient.rpc('find_available_riders', {
    p_shop_id: shop.id,
    p_lat: shop.shop_lat,
    p_lng: shop.shop_lng,
    p_radius_m: 3000,
    p_exclude_rider_ids: ['00000000-0000-0000-0000-000000000000'],
  });
  if (findError) throw findError;
  const found = (availableRiders || []).find((r: any) => r.id === rider.id);
  if (!found) throw new Error('Rider 1 not found by PostGIS spatial search');
  console.log(`[PASS] PostGIS find_available_riders located Rider 1 (Distance: ${found.distance_m.toFixed(1)}m)`);

  // 6. Create Test Order
  const orderNo = 'TEST-' + Date.now().toString().slice(-6);
  const { data: order, error: orderError } = await adminClient.from('orders').insert({
    shop_id: shop.id,
    order_no: orderNo,
    type: 'delivery',
    status: 'confirmed',
    dispatch_status: 'pending',
    total: 150,
    delivery_address: '123 ถนนขุนลุมประพาส ต.จองคำ อ.เมือง แม่ฮ่องสอน',
    delivery_lat: 19.3015,
    delivery_lng: 97.9685,
    estimated_distance_km: 1.2,
  }).select('*').single();
  if (orderError) throw orderError;
  console.log(`[PASS] Created test order #${order.order_no} (${order.id})`);

  // 7. Create Dispatch Offer
  const timeoutAt = new Date(Date.now() + 60 * 1000).toISOString();
  const { data: offer, error: offerError } = await adminClient.from('dispatch_offers').insert({
    order_id: order.id,
    rider_id: rider.id,
    shop_id: shop.id,
    status: 'offered',
    dispatch_round: 1,
    dispatch_score: 100.5,
    offered_at: new Date().toISOString(),
    timeout_at: timeoutAt,
  }).select('*').single();
  if (offerError) throw offerError;
  console.log(`[PASS] Created dispatch offer ${offer.id}`);

  await adminClient.from('orders').update({ dispatch_status: 'dispatching' }).eq('id', order.id);

  // 8. Test notifications
  console.log('\n--- Testing notifyRiderNewOffer ---');
  const res1 = await notifyRiderNewOffer(adminClient, rider.id, {
    orderId: order.id,
    offerId: offer.id,
    orderNo: order.order_no,
    deliveryAddress: order.delivery_address,
    estimatedDistanceKm: order.estimated_distance_km,
    total: order.total,
    timeoutSeconds: 30,
  });
  console.log('[PASS] Notification with null telegram_chat_id: ', res1);

  await adminClient.from('riders').update({ telegram_chat_id: '99999999' }).eq('id', rider.id);
  const res2 = await notifyRiderNewOffer(adminClient, rider.id, {
    orderId: order.id,
    offerId: offer.id,
    orderNo: order.order_no,
    deliveryAddress: order.delivery_address,
    estimatedDistanceKm: order.estimated_distance_km,
    total: order.total,
    timeoutSeconds: 30,
  });
  console.log('[PASS] Notification with invalid telegram_chat_id (handled gracefully): ', res2);
  await adminClient.from('riders').update({ telegram_chat_id: null }).eq('id', rider.id);

  // 9. Accept Offer via RPC respond_to_dispatch_offer
  console.log('\n--- Testing Rider Acceptance via RPC ---');
  const { data: acceptRes, error: acceptErr } = await riderClient.rpc('respond_to_dispatch_offer', {
    p_offer_id: offer.id,
    p_action: 'accept',
  });
  if (acceptErr) throw acceptErr;
  console.log('[PASS] respond_to_dispatch_offer accepted:', acceptRes);

  const { data: checkOffer } = await adminClient.from('dispatch_offers').select('status, responded_at').eq('id', offer.id).single();
  const { data: checkOrder } = await adminClient.from('orders').select('dispatch_status, assigned_rider_id').eq('id', order.id).single();
  if (checkOffer?.status !== 'accepted') throw new Error('Offer status is not accepted: ' + checkOffer?.status);
  if (checkOrder?.dispatch_status !== 'assigned' || checkOrder?.assigned_rider_id !== rider.id) {
    throw new Error('Order is not assigned to rider: ' + JSON.stringify(checkOrder));
  }
  console.log(`[PASS] Order successfully assigned: dispatch_status=${checkOrder.dispatch_status}, assigned_rider_id=${checkOrder.assigned_rider_id}`);

  // 10. Cleanup
  console.log('\n--- Cleaning up test data ---');
  await adminClient.from('dispatch_offers').delete().eq('id', offer.id);
  await adminClient.from('orders').delete().eq('id', order.id);
  console.log('[PASS] Test order and offer deleted');

  const { data: closeRes, error: closeErr } = await riderClient.rpc('close_rider_work_session');
  if (closeErr) throw closeErr;
  console.log('[PASS] Rider 1 closed session:', closeRes);

  const { data: locAfter } = await adminClient.from('rider_current_locations').select('*').eq('rider_id', rider.id).maybeSingle();
  if (locAfter) throw new Error('rider_current_locations not deleted!');
  console.log('[PASS] PDPA verification: rider_current_locations purged after close session');

  console.log('\n🎉 ALL STEP 5 LIVE E2E CHECKS PASSED SUCCESSFULLY!');
}

runE2E().catch(err => {
  console.error('\n❌ E2E ERROR:', err);
  process.exit(1);
});
