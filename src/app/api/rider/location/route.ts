import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/rider/location
 * ไรเดอร์ส่งพิกัด GPS ปัจจุบัน
 * ต้องมี Work Session ที่เปิดอยู่ก่อน — ไม่มี session = ปฏิเสธ (PDPA)
 *
 * Body:
 *   shop_id: string
 *   lat: number
 *   lng: number
 *   accuracy?: number   (meters)
 *   heading?: number    (degrees)
 *   speed?: number      (km/h)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. ตรวจ Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { shop_id, lat, lng, accuracy, heading, speed } = body;

    // 2. Validate พิกัด
    if (typeof shop_id !== 'string' || shop_id.length === 0) {
      return NextResponse.json(
        { code: 'INVALID_SHOP_ID', error: 'shop_id is required' },
        { status: 400 }
      );
    }
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return NextResponse.json(
        { code: 'INVALID_COORDINATES', error: 'lat และ lng ต้องเป็นตัวเลข' },
        { status: 400 }
      );
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { code: 'INVALID_COORDINATES', error: 'ค่า lat/lng ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // 3. เรียก RPC report_rider_location
    const { data: result, error: rpcError } = await supabase.rpc('report_rider_location', {
      p_shop_id: shop_id,
      p_lat: lat,
      p_lng: lng,
      p_accuracy: accuracy ?? null,
      p_heading: heading ?? null,
      p_speed: speed ?? null,
    });

    if (rpcError) {
      if (rpcError.message.includes('WORK_SESSION_REQUIRED')) {
        return NextResponse.json(
          { code: 'WORK_SESSION_REQUIRED', error: 'ต้องเปิด Work Session ก่อนส่งพิกัด' },
          { status: 403 }
        );
      }
      if (rpcError.message.includes('RIDER_NOT_FOUND_OR_INACTIVE')) {
        return NextResponse.json(
          { code: 'RIDER_NOT_FOUND_OR_INACTIVE', error: 'ไม่พบข้อมูลไรเดอร์' },
          { status: 404 }
        );
      }

      console.error('[rider/location] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกพิกัดได้' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[rider/location] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
