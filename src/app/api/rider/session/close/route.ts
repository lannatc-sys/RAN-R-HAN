import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CloseSessionResult {
  session_id: string;
  closed_at: string;
}

/**
 * POST /api/rider/session/close
 * Session closure, current-location deletion and pending-offer rejection happen
 * atomically in the database. Success is returned only after all three commit.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.session_id === 'string' ? body.session_id : null;

    const { data, error } = await supabase.rpc('close_rider_work_session', {
      p_session_id: sessionId,
    });

    if (error) {
      const notFound = error.message.includes('OPEN_WORK_SESSION_NOT_FOUND');
      console.error('[session/close] RPC error:', error.code);
      return NextResponse.json(
        { error: notFound ? 'ไม่มี Work Session ที่เปิดอยู่' : 'ไม่สามารถปิด Work Session ได้' },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json(data as CloseSessionResult);
  } catch (err) {
    console.error('[session/close] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
