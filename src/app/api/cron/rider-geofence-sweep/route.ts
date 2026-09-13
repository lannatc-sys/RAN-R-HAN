import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Automated Rider Geofence Sweep Job
 * ปิด Work Session ของไรเดอร์ที่อยู่นอกพื้นที่ทำงานเกิน 15 นาที
 */
export async function GET(req: NextRequest) {
  return handleGeofenceSweep(req);
}

export async function POST(req: NextRequest) {
  return handleGeofenceSweep(req);
}

async function handleGeofenceSweep(req: NextRequest) {
  try {
    // ตรวจสอบ CRON_SECRET เพื่อความปลอดภัย (fail-closed: ต้องตั้งค่าเสมอ ห้าม fallback ไปใช้ service-role key)
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error('[Geofence Sweep] CRON_SECRET is not configured — refusing request.');
      return NextResponse.json(
        { success: false, error: 'Server cron configuration is incomplete' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const now = new Date();

    const { data: closedCount, error } = await admin.rpc('sweep_expired_rider_geofence_sessions');

    if (error) {
      console.error('[Geofence Sweep Error]:', error);
      return NextResponse.json(
        { success: false, error: 'Geofence sweep dependency failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        closed_count: closedCount ?? 0,
      },
      message: 'Automated rider geofence sweep executed successfully.',
    });
  } catch (err: unknown) {
    console.error('[Geofence Sweep Execution Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Geofence sweep execution failed' },
      { status: 500 }
    );
  }
}
