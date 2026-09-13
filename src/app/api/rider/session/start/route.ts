import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/rider/session/start
 * ไรเดอร์กด "Start Work" เพื่อเปิด Work Session ใหม่
 *
 * Body: { shop_id: string, lat: number, lng: number, device_info?: object }
 * Returns: { session_id: string, started_at: string }
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
    const { shop_id, lat, lng, device_info } = body;

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id is required' }, { status: 400 });
    }

    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return NextResponse.json(
        { code: 'INVALID_COORDINATES', error: 'lat and lng are required and must be numbers' },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { code: 'INVALID_COORDINATES', error: 'ค่า lat/lng ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // 2. เรียก RPC start_rider_work_session
    const { data: result, error: rpcError } = await supabase.rpc('start_rider_work_session', {
      p_shop_id: shop_id,
      p_lat: lat,
      p_lng: lng,
      p_device_info: device_info ?? null,
    });

    if (rpcError) {
      if (rpcError.message.includes('OUTSIDE_WORK_AREA:')) {
        return NextResponse.json(
          {
            code: 'OUTSIDE_WORK_AREA',
            error: 'คุณอยู่นอกเขตพื้นที่การทำงาน กรุณากลับเข้าเขตพื้นที่ก่อนเริ่มงาน',
          },
          { status: 403 }
        );
      }
      if (rpcError.message.includes('RIDER_NOT_FOUND_OR_INACTIVE')) {
         return NextResponse.json(
          {
            code: 'RIDER_NOT_FOUND_OR_INACTIVE',
            error: 'ไม่พบข้อมูลไรเดอร์ในร้านค้านี้ หรือบัญชีถูกระงับ',
          },
          { status: 404 }
        );
      }

      console.error('[session/start] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'ไม่สามารถเปิด Work Session ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session_id: result.session_id,
      started_at: result.started_at,
      resumed: result.resumed,
    });
  } catch (err) {
    console.error('[session/start] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
