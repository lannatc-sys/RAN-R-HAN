import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/rider/offers/active
 * ดึง Offer ที่ยังรอไรเดอร์คนนี้ตอบอยู่ (status = offered และยังไม่หมดเวลา)
 * ใช้โดยหน้า Rider PWA เพื่อ Poll งานใหม่
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!rider) {
      return NextResponse.json({ offer: null });
    }

    const nowIso = new Date().toISOString();

    const { data: offer } = await supabase
      .from('dispatch_offers')
      .select('id, order_id, status, timeout_at, offered_at, dispatch_round')
      .eq('rider_id', rider.id)
      .eq('status', 'offered')
      .gt('timeout_at', nowIso)
      .order('offered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!offer) {
      return NextResponse.json({ offer: null });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, order_no, total, delivery_fee, delivery_address, delivery_lat, delivery_lng, estimated_distance_km, customer_name, note')
      .eq('id', offer.order_id)
      .maybeSingle();

    return NextResponse.json({
      offer: {
        ...offer,
        order: order ?? null,
      },
    });
  } catch (err) {
    console.error('[rider/offers/active] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
