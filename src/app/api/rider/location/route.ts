import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/rider/location
 * ไรเดอร์ส่งพิกัด GPS ปัจจุบัน (Upsert 1 Row per Rider)
 * ต้องมี Work Session ที่เปิดอยู่ก่อน — ไม่มี session = ปฏิเสธ (PDPA)
 *
 * Body:
 *   lat: number
 *   lng: number
 *   accuracy?: number   (meters)
 *   heading?: number    (degrees)
 *   speed?: number      (km/h)
 *
 * Returns: { updated_at: string }
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
    const { lat, lng, accuracy, heading, speed } = body;

    // 2. Validate พิกัด
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'lat และ lng ต้องเป็นตัวเลข' },
        { status: 400 }
      );
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'ค่า lat/lng ไม่ถูกต้อง' },
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
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลไรเดอร์' },
        { status: 404 }
      );
    }

    // 4. ตรวจว่ามี Work Session เปิดอยู่ (PDPA Guard)
    const { data: session } = await supabase
      .from('rider_work_sessions')
      .select('id')
      .eq('rider_id', rider.id)
      .eq('status', 'open')
      .maybeSingle();

    if (!session) {
      return NextResponse.json(
        { error: 'ต้องเปิด Work Session ก่อนส่งพิกัด' },
        { status: 403 }
      );
    }

    // 5. Upsert พิกัด (1 Row per Rider)
    const updatedAt = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('rider_current_locations')
      .upsert(
        {
          rider_id: rider.id,
          shop_id: rider.shop_id,
          work_session_id: session.id,
          lat,
          lng,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          updated_at: updatedAt,
        },
        { onConflict: 'rider_id' }
      );

    if (upsertError) {
      console.error('[rider/location] Upsert error:', upsertError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกพิกัดได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({ updated_at: updatedAt });
  } catch (err) {
    console.error('[rider/location] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
