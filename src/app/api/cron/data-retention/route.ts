import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Automated Data Retention Job (WP-22)
 * รันตามรอบเพื่อทำลายหรือล้างข้อมูลที่ไม่จำเป็นตามข้อกำหนด PDPA
 */
export async function GET(req: NextRequest) {
  return handleRetention(req);
}

export async function POST(req: NextRequest) {
  return handleRetention(req);
}

async function handleRetention(req: NextRequest) {
  try {
    // ตรวจสอบ CRON_SECRET เพื่อความปลอดภัย (fail-closed: ต้องตั้งค่าเสมอ ห้าม fallback ไปใช้ service-role key)
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error('[Data Retention] CRON_SECRET is not configured — refusing request.');
      return NextResponse.json({ error: 'SERVER_MISCONFIGURED: CRON_SECRET is not set' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Invalid cron secret' }, { status: 401 });
    }

    const admin = createAdminClient();
    const now = new Date();

    // 1. คำนวณวันย้อนหลัง 90 วัน
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    // 2. คำนวณวันย้อนหลัง 365 วัน (1 ปี)
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

    // ก) หาออเดอร์ที่เคยมีการชำระเงินสำเร็จ (verified) ไว้ก่อน — ห้ามลบออเดอร์เหล่านี้แม้จะถูกยกเลิก
    // เพราะ payments.order_id เป็น ON DELETE CASCADE การลบ order จะทำลายหลักฐานการเงิน/บัญชีไปด้วย
    const { data: paidOrderRows, error: paidLookupErr } = await admin
      .from('payments')
      .select('order_id')
      .eq('status', 'verified');

    if (paidLookupErr) {
      console.error('[Retention Error - Paid Order Lookup]:', paidLookupErr);
    }

    const paidOrderIds = (paidOrderRows ?? []).map((p) => p.order_id);

    // ข) ลบออเดอร์ที่ยกเลิก และไม่เคยชำระเงินสำเร็จ เกิน 90 วัน
    let orderDeleteQuery = admin
      .from('orders')
      .delete()
      .eq('status', 'cancelled')
      .lt('created_at', ninetyDaysAgo);

    if (paidOrderIds.length > 0) {
      orderDeleteQuery = orderDeleteQuery.not('id', 'in', `(${paidOrderIds.join(',')})`);
    }

    const { data: deletedOrders, error: delOrderErr } = await orderDeleteQuery.select('id');

    if (delOrderErr) {
      console.error('[Retention Error - Orders]:', delOrderErr);
    }

    // ข) ล้างข้อความดิบ raw_input_text ใน preorder_items ที่เก่ากว่า 90 วัน (คงเหลือรายการสั่งซื้อที่สรุปแล้ว)
    const { data: clearedPreorders, error: clearPreErr } = await admin
      .from('preorder_items')
      .update({ raw_input_text: null })
      .lt('created_at', ninetyDaysAgo)
      .not('raw_input_text', 'is', null)
      .select('id');

    if (clearPreErr) {
      console.error('[Retention Error - Preorder Raw Text]:', clearPreErr);
    }

    // ค) ลบ Audit Logs ที่เก่ากว่า 1 ปี
    const { data: deletedAudits, error: delAuditErr } = await admin
      .from('audit_logs')
      .delete()
      .lt('created_at', oneYearAgo)
      .select('id');

    if (delAuditErr) {
      console.error('[Retention Error - Audit Logs]:', delAuditErr);
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        cancelledOrdersDeleted: deletedOrders?.length || 0,
        preorderRawTextsCleared: clearedPreorders?.length || 0,
        auditLogsPurged: deletedAudits?.length || 0,
      },
      message: 'Automated data retention cleanup executed successfully.',
    });
  } catch (err: any) {
    console.error('[Data Retention Execution Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
