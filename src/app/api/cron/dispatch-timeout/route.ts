import { NextRequest, NextResponse } from 'next/server';
import { timeoutOfferAction } from '@/app/actions/dispatch';

/**
 * GET|POST /api/cron/dispatch-timeout
 * ปิด Offer ที่หมดเวลา แล้วคืน Order กลับเป็น pending เพื่อให้ Dispatch รอบถัดไปทำงาน (§5)
 * ป้องกันด้วย Bearer CRON_SECRET เหมือน /api/cron/data-retention
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await timeoutOfferAction();
    console.log(
      `[cron/dispatch-timeout] สำเร็จ: expired=${result.timed_out ?? 0}, redispatched=${result.redispatched ?? 0}, errors=${result.errors ?? 0}, ran_at=${new Date().toISOString()}`
    );
    return NextResponse.json({
      ok: true,
      expired: result.timed_out ?? 0,
      redispatched: result.redispatched ?? 0,
      errors: result.errors ?? 0,
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    // CRITICAL: RPC failure ต้องไม่กลืน — คืน non-2xx และ ok:false
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[cron/dispatch-timeout] RPC/Infrastructure failure:', errorMessage);
    return NextResponse.json(
      {
        ok: false,
        error: 'Dispatch timeout processing failed',
        // ห้ามเปิดเผยรายละเอียด error ให้ client — บันทึกใน log เท่านั้น
      },
      { status: 502 } // Bad Gateway — signal ว่า upstream (RPC) ล้มเหลว
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
