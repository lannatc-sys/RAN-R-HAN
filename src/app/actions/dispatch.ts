'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ==============================================================================
// Types
// ==============================================================================

interface DispatchResult {
  success: boolean;
  offer_id?: string;
  rider_id?: string;
  rider_name?: string;
  error?: string;
}

interface CandidateRider {
  id: string;
  display_name: string;
  performance_score: number;
  lat: number;
  lng: number;
  distance_m: number; // ระยะทางตรง (meter) จาก PostGIS
}

// ==============================================================================
// Config (Phase 1 Fixed Values — รอ A/B Testing)
// ==============================================================================
const OFFER_TIMEOUT_SECONDS = 30;
const INITIAL_RADIUS_M = 3000;  // 3 km
const EXPANDED_RADIUS_M = 8000; // 8 km
const MIN_CANDIDATES_THRESHOLD = 1;
const MAX_DISPATCH_ROUNDS = 3;

// ==============================================================================
// dispatchOrderAction
// Admin / System เรียกเพื่อ Trigger Dispatch Engine สำหรับ Order
// ==============================================================================

export async function dispatchOrderAction(
  orderId: string
): Promise<DispatchResult> {
  const supabase = await createClient();

  // 1. ตรวจ Auth — ต้องเป็น Staff/Owner ของร้าน
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  // 2. ดึงข้อมูล Order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, shop_id, delivery_lat, delivery_lng, dispatch_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'ไม่พบ Order' };
  }

  // ตรวจสิทธิ์
  const { data: hasAccess } = await supabase
    .rpc('has_shop_access', { lookup_shop_id: order.shop_id });

  if (!hasAccess) {
    return { success: false, error: 'ไม่มีสิทธิ์ Dispatch Order ของร้านนี้' };
  }

  // ตรวจสถานะ Order
  if (order.dispatch_status === 'assigned' || order.dispatch_status === 'in_transit') {
    return { success: false, error: `Order มีสถานะ "${order.dispatch_status}" แล้ว` };
  }

  if (!order.delivery_lat || !order.delivery_lng) {
    return { success: false, error: 'Order ไม่มีพิกัดปลายทาง (delivery_lat/lng)' };
  }

  // 3. อัปเดต Order เป็น dispatching
  await supabase
    .from('orders')
    .update({ dispatch_status: 'dispatching' })
    .eq('id', orderId);

  // 4. หา round ล่าสุดที่ dispatch แล้ว
  // เก็บกวาด Offer ที่หมดเวลาก่อนเริ่มรอบใหม่ (ไม่ต้องพึ่ง Cron รายนาที = ประหยัดต้นทุน)
  try {
    await timeoutOfferAction();
  } catch (err) {
    console.warn('[dispatch] timeout sweep failed (non-critical):', err);
  }

  const { data: lastOffer } = await supabase
    .from('dispatch_offers')
    .select('dispatch_round')
    .eq('order_id', orderId)
    .order('dispatch_round', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentRound = (lastOffer?.dispatch_round ?? 0) + 1;

  if (currentRound > MAX_DISPATCH_ROUNDS) {
    // ครบ 3 รอบแล้ว — ยังไม่มีไรเดอร์
    await supabase
      .from('orders')
      .update({ dispatch_status: 'failed' })
      .eq('id', orderId);

    return {
      success: false,
      error: `ไม่พบไรเดอร์หลังจาก ${MAX_DISPATCH_ROUNDS} รอบ — Order ถูก Flag เป็น failed`,
    };
  }

  // 5. หา Candidate Riders ด้วย PostGIS (admin client เพื่อ bypass RLS)
  const adminClient = createAdminClient();

  // จุดศูนย์กลางการค้นหาไรเดอร์ = พิกัดร้าน (จุดรับอาหาร) — docs/03-rider-system-architecture.md §4
  // ถ้าร้านยังไม่ได้ตั้งพิกัด ให้ fallback เป็นพิกัดปลายทางของลูกค้า
  const { data: shopGeo } = await adminClient
    .from('shops')
    .select('shop_lat, shop_lng')
    .eq('id', order.shop_id)
    .maybeSingle();

  const hasShopGeo =
    typeof shopGeo?.shop_lat === 'number' && typeof shopGeo?.shop_lng === 'number';

  if (!hasShopGeo) {
    console.warn(
      `[dispatch] ร้าน ${order.shop_id} ยังไม่ได้ตั้งพิกัดร้าน — fallback ใช้พิกัดปลายทางลูกค้าเป็นจุดค้นหาไรเดอร์`
    );
  }

  // ใช้พิกัดร้านทั้งคู่ หรือไม่ใช้เลย — ห้ามผสม lat ร้านกับ lng ลูกค้า
  const pickupLat = hasShopGeo ? (shopGeo!.shop_lat as number) : order.delivery_lat;
  const pickupLng = hasShopGeo ? (shopGeo!.shop_lng as number) : order.delivery_lng;

  let candidates = await findCandidateRiders(
    adminClient,
    order.shop_id,
    pickupLat,
    pickupLng,
    INITIAL_RADIUS_M,
    orderId // exclude riders ที่เคย reject order นี้แล้ว
  );

  // Dynamic Radius Expansion
  if (candidates.length < MIN_CANDIDATES_THRESHOLD) {
    candidates = await findCandidateRiders(
      adminClient,
      order.shop_id,
      pickupLat,
      pickupLng,
      EXPANDED_RADIUS_M,
      orderId
    );
  }

  if (candidates.length === 0) {
    // ไม่มีไรเดอร์ว่างในรอบนี้
    await supabase
      .from('orders')
      .update({ dispatch_status: 'pending' })
      .eq('id', orderId);

    return {
      success: false,
      error: `รอบที่ ${currentRound}: ไม่พบไรเดอร์ที่พร้อมรับงาน`,
    };
  }

  // 6. เลือก Best Rider (Dispatch Score)
  const bestRider = scoreCandidates(candidates)[0];

  // 7. สร้าง Dispatch Offer
  const timeoutAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000).toISOString();

  const { data: newOffer, error: offerError } = await adminClient
    .from('dispatch_offers')
    .insert({
      order_id: orderId,
      rider_id: bestRider.id,
      shop_id: order.shop_id,
      status: 'offered',
      dispatch_round: currentRound,
      dispatch_score: calculateScore(bestRider),
      offered_at: new Date().toISOString(),
      timeout_at: timeoutAt,
    })
    .select('id')
    .single();

  if (offerError || !newOffer) {
    console.error('[dispatch] Create offer error:', offerError);
    return { success: false, error: 'ไม่สามารถสร้าง Dispatch Offer ได้' };
  }

  // 8. แจ้ง Rider ผ่าน Telegram (Phase 1 — ชั่วคราวแทน Mobile Push)
  await notifyRiderViaTelegram(adminClient, bestRider.id, orderId, newOffer.id, OFFER_TIMEOUT_SECONDS);

  return {
    success: true,
    offer_id: newOffer.id,
    rider_id: bestRider.id,
    rider_name: bestRider.display_name,
  };
}

// ==============================================================================
// findCandidateRiders — หาไรเดอร์ที่พร้อมรับงานในรัศมีที่กำหนด
// ==============================================================================

async function findCandidateRiders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  shopId: string,
  lat: number,
  lng: number,
  radiusM: number,
  orderId: string
): Promise<CandidateRider[]> {
  // หา rider ที่:
  // 1. active + มี work_session เปิดอยู่ (online)
  // 2. อยู่ในรัศมีที่กำหนด (PostGIS ST_DWithin)
  // 3. ยังไม่เคย reject/timeout order นี้
  // 4. ไม่มี order ที่กำลัง in_transit อยู่แล้ว (สูงสุด 2 order/rider Phase 1)

  // หา rider IDs ที่เคย reject/timeout order นี้แล้ว
  const { data: rejectedOffers } = await adminClient
    .from('dispatch_offers')
    .select('rider_id')
    .eq('order_id', orderId)
    .in('status', ['rejected', 'timed_out']);

  const excludedRiderIds = (rejectedOffers ?? []).map((o: { rider_id: string }) => o.rider_id);

  // หา rider ที่กำลังรับงาน in_transit (Phase 1: max 1 active job)
  const { data: busyRiders } = await adminClient
    .from('orders')
    .select('assigned_rider_id')
    .eq('shop_id', shopId)
    .eq('dispatch_status', 'in_transit')
    .not('assigned_rider_id', 'is', null);

  const busyRiderIds = (busyRiders ?? []).map((o: { assigned_rider_id: string }) => o.assigned_rider_id);

  const allExcluded = [...new Set([...excludedRiderIds, ...busyRiderIds])];

  // Query ด้วย PostGIS ST_DWithin
  // เนื่องจาก Supabase JS ไม่รองรับ ST_DWithin โดยตรง ใช้ RPC function
  const { data: nearby, error } = await adminClient
    .rpc('find_available_riders', {
      p_shop_id: shopId,
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
      p_exclude_rider_ids: allExcluded.length > 0 ? allExcluded : ['00000000-0000-0000-0000-000000000000'],
    });

  if (error) {
    console.error('[dispatch] findCandidateRiders error:', error);
    return [];
  }

  return (nearby ?? []).slice(0, 5); // Top 5 Candidates
}

// ==============================================================================
// calculateScore — คำนวณ Dispatch Score (§4.3)
// ==============================================================================

function calculateScore(rider: CandidateRider): number {
  // Phase 1: ใช้ระยะทางตรงเป็น proxy ETA + Performance Score
  // สูตร: score = (1 / distance_m) * 10000 + performance_score
  // ยิ่งใกล้และ performance ดี → score สูงกว่า
  const distanceScore = rider.distance_m > 0 ? (10000 / rider.distance_m) : 100;
  const performanceScore = rider.performance_score;
  return parseFloat((distanceScore + performanceScore).toFixed(4));
}

function scoreCandidates(candidates: CandidateRider[]): CandidateRider[] {
  return [...candidates].sort((a, b) => calculateScore(b) - calculateScore(a));
}

// ==============================================================================
// notifyRiderViaTelegram — แจ้ง Offer ผ่าน Telegram (Phase 1 fallback)
// ==============================================================================

async function notifyRiderViaTelegram(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  riderId: string,
  orderId: string,
  offerId: string,
  timeoutSeconds: number
) {
  try {
    // ดึง telegram_chat_id ของไรเดอร์ (เก็บใน riders.note หรือตาราง metadata — Phase 1 placeholder)
    // TODO: เพิ่มคอลัมน์ telegram_chat_id ใน riders table เมื่อระบบ mobile พร้อม
    const { data: rider } = await adminClient
      .from('riders')
      .select('display_name, phone')
      .eq('id', riderId)
      .single();

    if (!rider) return;

    // Log notification attempt (จะส่งผ่าน Telegram ได้เมื่อ rider มี chat_id)
    console.log(
      `[dispatch] 📱 Offer ${offerId} → Rider ${rider.display_name} (${rider.phone})` +
      ` | Order: ${orderId} | Timeout: ${timeoutSeconds}s`
    );

    // TODO Phase 1c: เมื่อ riders มีคอลัมน์ telegram_chat_id
    // await sendTelegramMessage(rider.telegram_chat_id, formatOfferMessage(...));
  } catch (err) {
    // Non-critical — Dispatch ยังสำเร็จแม้แจ้งเตือนล้มเหลว
    console.warn('[dispatch] Telegram notify failed (non-critical):', err);
  }
}

// ==============================================================================
// timeoutOfferAction — Cron Job เรียกตรวจ Offer ที่หมดเวลา
// ==============================================================================

export async function timeoutOfferAction(): Promise<{ timed_out: number; redispatched: number; errors: number }> {
  const adminClient = createAdminClient();

  // ใช้ RPC expire_dispatch_offers() แทนการ Query/direct update
  // RPC นี้ใช้ advisory lock + FOR UPDATE เพื่อป้องกัน concurrent run
  // และคืน summary (expired/redispatched/errors) สำหรับ logging
  const { data, error } = await adminClient
    .rpc('expire_dispatch_offers')
    .single();

  if (error) {
    console.error('[dispatch] expire_dispatch_offers RPC error:', error);
    return { timed_out: 0, redispatched: 0, errors: 1 };
  }

  const result = (data as any) || {};
  const timed_out = result.expired_count || 0;
  const redispatched = result.redispatched_count || 0;
  const errors = result.error_count || 0;

  console.log(
    `[dispatch/cron] expire_dispatch_offers 결과: expired=${timed_out}, redispatched=${redispatched}, errors=${errors}, run_at=${result.run_at}`
  );

  return { timed_out, redispatched, errors };
}
