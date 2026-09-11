import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/rider/session/start
 * ไรเดอร์กด "Start Work" เพื่อเปิด Work Session ใหม่
 *
 * Body: { shop_id: string, device_info?: object }
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
    const { shop_id, device_info } = body;

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id is required' }, { status: 400 });
    }

    // 2. หา rider record ของ user นี้
    const { data: rider, error: riderError } = await supabase
      .from('riders')
      .select('id, status')
      .eq('auth_user_id', user.id)
      .eq('shop_id', shop_id)
      .single();

    if (riderError || !rider) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลไรเดอร์ในร้านค้านี้' },
        { status: 404 }
      );
    }

    if (rider.status !== 'active') {
      return NextResponse.json(
        { error: 'บัญชีไรเดอร์ถูกระงับหรือไม่ได้ใช้งาน' },
        { status: 403 }
      );
    }

    // 3. ตรวจว่ามี session เปิดอยู่แล้วหรือไม่
    const { data: existingSession } = await supabase
      .from('rider_work_sessions')
      .select('id, started_at')
      .eq('rider_id', rider.id)
      .eq('status', 'open')
      .maybeSingle();

    if (existingSession) {
      // มี session เปิดอยู่แล้ว → ส่งกลับ session เดิม (idempotent)
      return NextResponse.json({
        session_id: existingSession.id,
        started_at: existingSession.started_at,
        resumed: true,
      });
    }

    // 4. สร้าง session ใหม่
    const { data: newSession, error: insertError } = await supabase
      .from('rider_work_sessions')
      .insert({
        rider_id: rider.id,
        shop_id,
        status: 'open',
        device_info: device_info ?? null,
      })
      .select('id, started_at')
      .single();

    if (insertError || !newSession) {
      // Unique constraint uq_rider_one_open_work_session means a concurrent
      // request already opened a session for this rider between our check
      // above and this insert. Re-select and return it — same shape as the
      // "already open" response — instead of a raw 500.
      if (insertError?.code === '23505') {
        const { data: raceSession } = await supabase
          .from('rider_work_sessions')
          .select('id, started_at')
          .eq('rider_id', rider.id)
          .eq('status', 'open')
          .maybeSingle();

        if (raceSession) {
          return NextResponse.json({
            session_id: raceSession.id,
            started_at: raceSession.started_at,
            resumed: true,
          });
        }
      }

      console.error('[session/start] Insert error:', insertError);
      return NextResponse.json(
        { error: 'ไม่สามารถเปิด Work Session ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session_id: newSession.id,
      started_at: newSession.started_at,
      resumed: false,
    });
  } catch (err) {
    console.error('[session/start] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
