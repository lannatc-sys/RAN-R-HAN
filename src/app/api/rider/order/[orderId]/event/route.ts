import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

interface DeliveryEventResult {
  event_id: string;
  server_received_at: string;
}

function rpcErrorStatus(message: string): number {
  if (message.includes('ORDER_NOT_FOUND')) return 404;
  if (message.includes('ORDER_FORBIDDEN')) return 403;
  if (message.includes('POD_REQUIRED') || message.includes('INVALID_DELIVERY_EVENT')) return 400;
  return 409;
}

/**
 * POST /api/rider/order/[orderId]/event
 * Event validation, POD claiming and order-state update are one DB transaction.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orderId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event_type, gps_lat, gps_lng, note, pod_id } = body;

    if (!VALID_EVENT_TYPES.includes(event_type as DeliveryEventType)) {
      return NextResponse.json(
        { error: `event_type ไม่ถูกต้อง (ค่าที่ใช้ได้: ${VALID_EVENT_TYPES.join(', ')})` },
        { status: 400 }
      );
    }

    if (gps_lat != null && (typeof gps_lat !== 'number' || gps_lat < -90 || gps_lat > 90)) {
      return NextResponse.json({ error: 'gps_lat ไม่ถูกต้อง' }, { status: 400 });
    }
    if (gps_lng != null && (typeof gps_lng !== 'number' || gps_lng < -180 || gps_lng > 180)) {
      return NextResponse.json({ error: 'gps_lng ไม่ถูกต้อง' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('finalize_rider_delivery_event', {
      p_order_id: orderId,
      p_event_type: event_type,
      p_gps_lat: gps_lat ?? null,
      p_gps_lng: gps_lng ?? null,
      p_note: typeof note === 'string' ? note : null,
      p_pod_id: typeof pod_id === 'string' ? pod_id : null,
    });

    if (error) {
      console.error('[delivery/event] RPC error:', error.code);
      const podError = error.message.includes('POD');
      return NextResponse.json(
        {
          error: podError
            ? 'ภาพ POD ไม่ถูกต้อง ถูกใช้ไปแล้ว หรือไม่ตรงกับสถานะงาน'
            : 'ลำดับสถานะงานไม่ถูกต้อง กรุณารีเฟรชหน้าจอแล้วลองใหม่',
        },
        { status: rpcErrorStatus(error.message) }
      );
    }

    return NextResponse.json(data as DeliveryEventResult);
  } catch (err) {
    console.error('[delivery/event] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
