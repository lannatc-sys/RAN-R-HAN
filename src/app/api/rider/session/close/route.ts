import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/rider/session/close
 * ไรเดอร์กด "Close System" เพื่อปิด Work Session ที่เปิดอยู่
 * GPS จะหยุดส่งทันที (ตาม PDPA - Privacy by Design)
 *
 * Body: { session_id?: string } (ถ้าไม่ระบุจะ auto-close session ล่าสุดที่ยังเปิดอยู่)
 * Returns: { session_id: string, closed_at: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. ตรวจ Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { session_id } = body;

    // 2. หา rider record ของ user นี้
    const { data: rider, error: riderError } = await supabase
      .from('riders')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (riderError || !rider) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลไรเดอร์' },
        { status: 404 }
      );
    }

    // 3. หา session ที่จะปิด
    let sessionQuery = supabase
      .from('rider_work_sessions')
      .select('id')
      .eq('rider_id', rider.id)
      .eq('status', 'open');

    if (session_id) {
      sessionQuery = sessionQuery.eq('id', session_id);
    }

    const { data: session } = await sessionQuery.maybeSingle();

    if (!session) {
      return NextResponse.json(
        { error: 'ไม่มี Work Session ที่เปิดอยู่' },
        { status: 404 }
      );
    }

    // 4. ปิด session + ลบพิกัดปัจจุบัน (PDPA: หยุดเก็บ GPS เมื่อปิด session)
    const closedAt = new Date().toISOString();

    // ปิดงาน = ปฏิเสธ Offer ที่ยังค้างอยู่ทั้งหมด เพื่อให้ Dispatch หาไรเดอร์คนถัดไปทันที (§6)
    await supabase
      .from('dispatch_offers')
      .update({ status: 'rejected', responded_at: closedAt })
      .eq('rider_id', rider.id)
      .eq('status', 'offered');

    const [sessionUpdate, locationDelete] = await Promise.allSettled([
      supabase
        .from('rider_work_sessions')
        .update({ status: 'closed', closed_at: closedAt })
        .eq('id', session.id),
      supabase
        .from('rider_current_locations')
        .delete()
        .eq('rider_id', rider.id),
    ]);

    if (sessionUpdate.status === 'rejected') {
      console.error('[session/close] Update error:', sessionUpdate.reason);
      return NextResponse.json(
        { error: 'ไม่สามารถปิด Work Session ได้' },
        { status: 500 }
      );
    }

    // location delete failure is non-critical — log only
    if (locationDelete.status === 'rejected') {
      console.warn('[session/close] Location delete failed (non-critical):', locationDelete.reason);
    }

    return NextResponse.json({
      session_id: session.id,
      closed_at: closedAt,
    });
  } catch (err) {
    console.error('[session/close] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
