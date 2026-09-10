import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { splitDeliveryFee } from '@/lib/rider';

/**
 * GET /api/rider/summary
 * สรุปงานของไรเดอร์ "วันนี้" (ตามเวลาไทย) — จำนวนงานที่ส่งสำเร็จ และค่าตอบแทนโดยประมาณ
 * หมายเหตุ: เป็นตัวเลขประมาณการเท่านั้น ยอดจริงยึดตาม Daily Settlement ที่ร้านอนุมัติ (§12)
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!rider) {
      return NextResponse.json({ delivered_today: 0, estimated_payout: 0 });
    }

    // ขอบเขต "วันนี้" ตามเวลาไทย (UTC+7) — เริ่มนับ 00:00 น. ตามเวลาไทย
    const nowUtcMs = Date.now();
    const bangkokNow = new Date(nowUtcMs + 7 * 60 * 60 * 1000);
    const startOfDayUtcMs = Date.UTC(
      bangkokNow.getUTCFullYear(),
      bangkokNow.getUTCMonth(),
      bangkokNow.getUTCDate()
    ) - 7 * 60 * 60 * 1000;
    const startIso = new Date(startOfDayUtcMs).toISOString();

    const { data: deliveredOrders } = await supabase
      .from('orders')
      .select('id, delivery_fee, updated_at')
      .eq('assigned_rider_id', rider.id)
      .eq('dispatch_status', 'delivered')
      .gte('updated_at', startIso);

    const list = deliveredOrders ?? [];
    const estimatedPayout = list.reduce(
      (sum, o) => sum + splitDeliveryFee(Number(o.delivery_fee ?? 0)).riderPayout,
      0
    );

    return NextResponse.json({
      delivered_today: list.length,
      estimated_payout: Math.round(estimatedPayout * 100) / 100,
      since: startIso,
    });
  } catch (err) {
    console.error('[rider/summary] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
