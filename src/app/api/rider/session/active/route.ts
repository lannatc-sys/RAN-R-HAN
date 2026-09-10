import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/rider/session/active
 * ดึงข้อมูล Work Session ที่กำลังเปิดอยู่ของไรเดอร์
 *
 * Returns: { session | null }
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. ตรวจ Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. หา rider record
    const { data: rider, error: riderError } = await supabase
      .from('riders')
      .select('id, shop_id, display_name, status')
      .eq('auth_user_id', user.id)
      .single();

    if (riderError || !rider) {
      return NextResponse.json({ session: null, rider: null });
    }

    // 3. หา open session
    const { data: session } = await supabase
      .from('rider_work_sessions')
      .select('id, started_at, device_info')
      .eq('rider_id', rider.id)
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .maybeSingle();

    return NextResponse.json({
      rider: {
        id: rider.id,
        shop_id: rider.shop_id,
        display_name: rider.display_name,
        status: rider.status,
      },
      session: session ?? null,
    });
  } catch (err) {
    console.error('[session/active] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
