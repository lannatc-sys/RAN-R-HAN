import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DeliveryEventType } from '@/lib/rider';

/**
 * GET /api/rider/orders/active
 * งานที่ไรเดอร์คนนี้กำลังทำอยู่ (assigned / in_transit) พร้อม Event ล่าสุดของแต่ละงาน
 * Phase 1 รองรับสูงสุด 2 ออเดอร์ต่อไรเดอร์ (§8)
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
      .select('id, shop_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!rider) {
      return NextResponse.json({ orders: [] });
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_no, status, dispatch_status, total, delivery_fee, estimated_distance_km, delivery_address, delivery_lat, delivery_lng, customer_name, customer_phone, note, created_at')
      .eq('assigned_rider_id', rider.id)
      .in('dispatch_status', ['assigned', 'in_transit'])
      .order('created_at', { ascending: true })
      .limit(2);

    const orderIds = (orders ?? []).map((o) => o.id);

    let eventsByOrder: Record<string, DeliveryEventType> = {};
    if (orderIds.length > 0) {
      const { data: events } = await supabase
        .from('delivery_events')
        .select('order_id, event_type, server_received_at')
        .in('order_id', orderIds)
        .eq('rider_id', rider.id)
        .order('server_received_at', { ascending: true });

      eventsByOrder = (events ?? []).reduce((acc, ev) => {
        acc[ev.order_id as string] = ev.event_type as DeliveryEventType;
        return acc;
      }, {} as Record<string, DeliveryEventType>);
    }

    // ดึงข้อมูลร้าน (จุดรับอาหาร) เพื่อให้ไรเดอร์กดนำทางไปรับได้
    const { data: shop } = await supabase
      .from('shops')
      .select('name, address, phone, shop_lat, shop_lng')
      .eq('id', rider.shop_id)
      .maybeSingle();

    return NextResponse.json({
      shop: shop ?? null,
      orders: (orders ?? []).map((o) => ({
        ...o,
        last_event: eventsByOrder[o.id] ?? null,
      })),
    });
  } catch (err) {
    console.error('[rider/orders/active] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
