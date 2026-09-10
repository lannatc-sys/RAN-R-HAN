import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidRiderEventTransition, isPodRequired } from '@/lib/rider';
import type { DeliveryEventType as RiderEventType } from '@/lib/rider';

const VALID_EVENT_TYPES = [
  'departed_to_shop',
  'arrived_at_shop',
  'picked_up',
  'departed_to_customer',
  'delivered',
  'unreachable_drop',
  'breakdown',
] as const;

type DeliveryEventType = typeof VALID_EVENT_TYPES[number];

/**
 * POST /api/rider/order/[orderId]/event
 * ไรเดอร์บันทึก Delivery Event (Pickup, Delivered ฯลฯ)
 *
 * Body:
 *   event_type: DeliveryEventType
 *   gps_lat?: number
 *   gps_lng?: number
 *   note?: string
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orderId } = await params;

    // 1. ตรวจ Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event_type, gps_lat, gps_lng, note, pod_id } = body;

    // 2. Validate event_type
    if (!VALID_EVENT_TYPES.includes(event_type as DeliveryEventType)) {
      return NextResponse.json(
        { error: `event_type ไม่ถูกต้อง (ค่าที่ใช้ได้: ${VALID_EVENT_TYPES.join(', ')})` },
        { status: 400 }
      );
    }

    // 3. หา rider record
    const { data: rider, error: riderError } = await supabase
      .from('riders')
      .select('id, shop_id')
      .eq('auth_user_id', user.id)
      .single();

    if (riderError || !rider) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลไรเดอร์' }, { status: 404 });
    }

    // 4. ตรวจว่า order นี้ assigned ให้ไรเดอร์นี้จริง
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, shop_id, assigned_rider_id, dispatch_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'ไม่พบ Order' }, { status: 404 });
    }

    if (order.assigned_rider_id !== rider.id) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์บันทึก Event ของ Order นี้' },
        { status: 403 }
      );
    }

    // 5. บันทึก Event (Server Timestamp เป็น Source of Truth)
    // ตรวจลำดับขั้นตอนงาน (State Guard) — กันกดข้ามขั้น/กดซ้ำ
    const { data: lastEventRow } = await supabase
      .from('delivery_events')
      .select('event_type')
      .eq('order_id', orderId)
      .eq('rider_id', rider.id)
      .order('server_received_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastEvent = (lastEventRow?.event_type ?? null) as RiderEventType | null;

    if (!isValidRiderEventTransition(lastEvent, event_type as RiderEventType)) {
      return NextResponse.json(
        { error: 'ลำดับสถานะงานไม่ถูกต้อง กรุณารีเฟรชหน้าจอแล้วลองใหม่' },
        { status: 409 }
      );
    }

    // POD Gate (§9.1): ห้ามปิดงานแบบ delivered / unreachable_drop โดยไม่มีภาพยืนยัน
    // ไรเดอร์ต้องอัปโหลดภาพผ่าน /api/rider/order/[orderId]/pod ก่อน แล้วส่ง pod_id เข้ามา
    let verifiedPodId: string | null = null;

    if (isPodRequired(event_type as RiderEventType)) {
      if (!pod_id || typeof pod_id !== 'string') {
        return NextResponse.json(
          { error: 'ต้องแนบภาพยืนยันการส่ง (POD) ก่อนปิดงาน' },
          { status: 400 }
        );
      }

      const { data: pod } = await supabase
        .from('pod_uploads')
        .select('id, delivery_event_id')
        .eq('id', pod_id)
        .eq('order_id', orderId)
        .eq('rider_id', rider.id)
        .maybeSingle();

      if (!pod || pod.delivery_event_id) {
        return NextResponse.json(
          { error: 'ภาพ POD ไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาถ่ายภาพใหม่' },
          { status: 400 }
        );
      }

      verifiedPodId = pod.id as string;
    }

    const serverReceivedAt = new Date().toISOString();

    const { data: event, error: insertError } = await supabase
      .from('delivery_events')
      .insert({
        order_id: orderId,
        rider_id: rider.id,
        shop_id: order.shop_id,
        event_type,
        server_received_at: serverReceivedAt,
        gps_lat: gps_lat ?? null,
        gps_lng: gps_lng ?? null,
        note: note ?? null,
      })
      .select('id')
      .single();

    if (insertError || !event) {
      console.error('[delivery/event] Insert error:', insertError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึก Event ได้' },
        { status: 500 }
      );
    }

    // 6. อัปเดต Order dispatch_status ตาม event_type
    // ผูกภาพ POD เข้ากับ Event ที่เพิ่งบันทึก (กันภาพเดิมถูกนำมาใช้ซ้ำ)
    if (verifiedPodId) {
      await supabase
        .from('pod_uploads')
        .update({ delivery_event_id: event.id })
        .eq('id', verifiedPodId);
    }

    const statusMap: Partial<Record<DeliveryEventType, string>> = {
      picked_up: 'in_transit',
      delivered: 'delivered',
      unreachable_drop: 'delivered', // ถือว่า delivered ตามเงื่อนไข unreachable
      breakdown: 'in_transit', // ยังอยู่ในระหว่างส่ง (รอ rescue)
    };

    const newDispatchStatus = statusMap[event_type as DeliveryEventType];
    if (newDispatchStatus) {
      await supabase
        .from('orders')
        .update({ dispatch_status: newDispatchStatus })
        .eq('id', orderId);
    }

    return NextResponse.json({
      event_id: event.id,
      server_received_at: serverReceivedAt,
    });
  } catch (err) {
    console.error('[delivery/event] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
