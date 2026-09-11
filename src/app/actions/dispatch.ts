'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyRiderNewOffer } from '@/lib/rider-notification';

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
    .select('id, order_no, shop_id, delivery_lat, delivery_lng, delivery_address, total, dispatch_status, estimated_distance_km')
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

  // 3. เก็บกวาด Offer ที่หมดเวลาก่อนเริ่มรอบใหม่ (ไม่ต้องพึ่ง Cron รายนาที = ประหยัดต้นทุน)
  // ต้องรันก่อน mark order เป็น dispatching เสมอ — ถ้า order นี้มี offer ค้างจากรอบก่อน
  // ที่หมดเวลาไปแล้วแต่ cron ยังไม่ทัน sweep, expire_dispatch_offers() จะ reset order
  // กลับเป็น pending ทันที ถ้า sweep รันหลัง mark dispatching มันจะ undo สถานะที่เพิ่งตั้งไป
  // และปล่อยให้ order ค้างเป็น pending ทั้งที่ offer รอบใหม่ถูกสร้างและ active อยู่จริง
  try {
    await timeoutOfferAction();
  } catch (err) {
    console.warn('[dispatch] timeout sweep failed (non-critical):', err);
  }

  // 4. อัปเดต Order เป็น dispatching
  await supabase
    .from('orders')
    .update({ dispatch_status: 'dispatching' })
    .eq('id', orderId);

  // 5. หา round ล่าสุดที่ dispatch แล้ว
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
    if (process.env.ALLOW_GEO_FALLBACK === 'true') {
      console.warn(
        `[dispatch] [WARNING] ร้าน ${order.shop_id} ยังไม่ได้ตั้งพิกัดร้าน — fallback ใช้พิกัดปลายทางลูกค้าเป็นจุดค้นหาไรเดอร์ (ALLOW_GEO_FALLBACK=true)`
      );
    } else {
      console.error(
        `[dispatch] [ERROR] ร้าน ${order.shop_id} ยังไม่ได้ตั้งพิกัดร้าน (shop_lat, shop_lng) — ปฏิเสธการ Dispatch`
      );
      await supabase
        .from('orders')
        .update({ dispatch_status: 'pending' })
        .eq('id', orderId);

      return {
        success: false,
        error: 'ร้านค้ายังไม่ได้ตั้งพิกัดร้าน (shop_lat, shop_lng) กรุณาตั้งค่าพิกัดร้านที่หน้าตั้งค่าก่อนใช้ระบบจัดส่ง',
      };
    }
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

  // 8. แจ้ง Rider ผ่าน Web Push และ Telegram (Phase 1)
  await notifyRiderNewOffer(adminClient, bestRider.id, {
    orderId,
    offerId: newOffer.id,
    orderNo: order.order_no ?? orderId.slice(0, 8),
    deliveryAddress: order.delivery_address ?? '',
    estimatedDistanceKm: order.estimated_distance_km ?? null,
    total: order.total ?? undefined,
    timeoutSeconds: OFFER_TIMEOUT_SECONDS,
  });

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
// timeoutOfferAction — Cron Job เรียกตรวจ Offer ที่หมดเวลา
// ==============================================================================

export async function timeoutOfferAction(): Promise<{ timed_out: number; redispatched: number; errors: number }> {
  const adminClient = createAdminClient();

  // ใช้ RPC expire_dispatch_offers() แทนการ Query/direct update
  // RPC นี้ใช้ advisory lock + FOR UPDATE เพื่อป้องกัน concurrent run
  // และคืน summary (expired/redispatched/errors) สำหรับ logging
  // SECURITY: function นี้ restricted ให้ service_role เท่านั้น (migration 20260912000001)
  const { data, error } = await adminClient
    .rpc('expire_dispatch_offers')
    .single();

  // CRITICAL: ห้ามกลืน infrastructure/RPC failure
  // - error ที่เป็น "function does not exist" หรือ "permission denied" = ปัญหาที่ต้อง fix ทันที
  // - error ที่เป็น network/timeout = transient, แต่ยังต้อง report ข upward
  if (error) {
    const errorMessage = error.message || String(error);
    console.error('[dispatch] expire_dispatch_offers RPC call failed:', errorMessage);

    // แยกกรณี permission error ออกมาเด่นชัด — มักหมายถึง migration ไม่ได้รัน
    if (errorMessage.includes('permission denied') || errorMessage.includes('does not exist')) {
      console.error(
        '[dispatch] CRITICAL: expire_dispatch_offers() ไม่สามารถเรียกใช้ได้ — ตรวจสอบว่า migration 20260912000001 ถูก apply แล้ว และ service_role มี GRANT EXECUTE'
      );
    }

    // Throw error ขึ้นไปให้ route จัดการ — ไม่ swallow
    throw new Error(`expire_dispatch_offers RPC failed: ${errorMessage}`);
  }

  const result = (data as any) || {};
  const timed_out = result.expired_count || 0;
  const redispatched = result.redispatched_count || 0;
  const errors = result.error_count || 0;

  console.log(
    `[dispatch/cron] expire_dispatch_offers result: expired=${timed_out}, redispatched=${redispatched}, errors=${errors}, run_at=${result.run_at}`
  );

  return { timed_out, redispatched, errors };
}
