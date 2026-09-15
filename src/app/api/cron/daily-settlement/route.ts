import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET|POST /api/cron/daily-settlement
 *
 * ออกใบค่ารอบของเมื่อวานให้ทุกร้านที่มีงานส่งถึงแล้วในวันนั้น
 * ป้องกันด้วย Bearer CRON_SECRET แบบเดียวกับ cron ตัวอื่นในโปรเจกต์
 *
 * ตรรกะการคิดเงินอยู่ใน RPC create_daily_settlement_draft ที่เดียว
 * เส้นทางนี้ไม่คำนวณอะไรเอง แค่หาว่าต้องเรียกให้ร้านไหนบ้าง
 * RPC เป็น idempotent อยู่แล้ว (on conflict do nothing) เรียกซ้ำจึงปลอดภัย
 */

/** วันที่ตามเวลาไทย ถอยหลังไปตามจำนวนวันที่ระบุ */
function bangkokDate(daysAgo: number): string {
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  bangkokNow.setUTCDate(bangkokNow.getUTCDate() - daysAgo);
  return bangkokNow.toISOString().slice(0, 10);
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/daily-settlement] CRON_SECRET is not configured — refusing request.');
    return NextResponse.json(
      { error: 'SERVER_MISCONFIGURED: CRON_SECRET is not set' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Invalid cron secret' }, { status: 401 });
  }

  // ปกติออกใบของเมื่อวาน ตรงกับค่า default ของ RPC
  // ระบุ ?date=YYYY-MM-DD ได้เพื่อออกใบย้อนหลังตอนแก้ปัญหา
  const requestedDate = req.nextUrl.searchParams.get('date');
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return NextResponse.json({ error: 'INVALID_DATE: ต้องเป็นรูปแบบ YYYY-MM-DD' }, { status: 400 });
  }
  const settlementDate = requestedDate ?? bangkokDate(1);

  try {
    const admin = createAdminClient();

    // เลือกเฉพาะร้านที่มีงานส่งถึงแล้วในวันนั้นจริง ๆ
    // ร้านที่ไม่มีงานจะไม่ถูกสร้างใบเปล่าทิ้งไว้
    const { data: deliveredEvents, error: eventsError } = await admin
      .from('delivery_events')
      .select('shop_id')
      .in('event_type', ['delivered', 'unreachable_drop'])
      .gte('server_received_at', `${settlementDate}T00:00:00+07:00`)
      .lt('server_received_at', `${settlementDate}T23:59:59.999+07:00`);

    if (eventsError) throw eventsError;

    const shopIds = [...new Set((deliveredEvents ?? []).map((row) => row.shop_id))].filter(Boolean);

    if (shopIds.length === 0) {
      console.log(`[cron/daily-settlement] ${settlementDate}: ไม่มีงานส่งถึงในวันนั้น ไม่ออกใบ`);
      return NextResponse.json({
        ok: true,
        settlement_date: settlementDate,
        shops_processed: 0,
        created: 0,
        failed: 0,
      });
    }

    let created = 0;
    let failed = 0;

    for (const shopId of shopIds) {
      const { error } = await admin.rpc('create_daily_settlement_draft', {
        p_shop_id: shopId,
        p_settlement_date: settlementDate,
      });

      if (error) {
        // ร้านหนึ่งพังต้องไม่ทำให้ร้านที่เหลือไม่ได้ใบ
        failed += 1;
        console.error(`[cron/daily-settlement] ร้าน ${shopId} ล้มเหลว:`, error.message);
      } else {
        created += 1;
      }
    }

    console.log(
      `[cron/daily-settlement] ${settlementDate}: ร้านที่ประมวลผล ${shopIds.length}, สำเร็จ ${created}, ล้มเหลว ${failed}`
    );

    // มีร้านล้มเหลวให้ตอบ non-2xx เพื่อให้ scheduler เห็นว่าต้องดู ไม่กลืนเงียบ
    const status = failed > 0 ? 502 : 200;
    return NextResponse.json(
      {
        ok: failed === 0,
        settlement_date: settlementDate,
        shops_processed: shopIds.length,
        created,
        failed,
      },
      { status }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/daily-settlement] Infrastructure failure:', message);
    return NextResponse.json({ ok: false, error: 'Daily settlement job failed' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
