import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/rider/offer/[offerId]/respond
 * ไรเดอร์ตอบรับหรือปฏิเสธ Dispatch Offer
 *
 * Body: { action: 'accept' | 'reject' }
 * Returns: { success: true, status: 'accepted' | 'rejected' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const supabase = await createClient();
    const { offerId } = await params;

    // 1. ตรวจ Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action ต้องเป็น "accept" หรือ "reject" เท่านั้น' },
        { status: 400 }
      );
    }

    // 2. หา rider record
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

    // 3. ดึง Offer และตรวจสิทธิ์
    const { data: offer, error: offerError } = await supabase
      .from('dispatch_offers')
      .select('id, status, rider_id, order_id, timeout_at')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return NextResponse.json(
        { error: 'ไม่พบ Offer นี้' },
        { status: 404 }
      );
    }

    // ตรวจว่า offer เป็นของไรเดอร์นี้
    if (offer.rider_id !== rider.id) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์ตอบรับ Offer นี้' },
        { status: 403 }
      );
    }

    // ตรวจสถานะ — ต้องยังเป็น 'offered' อยู่
    if (offer.status !== 'offered') {
      return NextResponse.json(
        { error: `Offer นี้มีสถานะ "${offer.status}" แล้ว ไม่สามารถตอบได้` },
        { status: 409 }
      );
    }

    // ตรวจ Timeout — ถ้าเลยเวลาแล้วปฏิเสธทันที
    if (offer.timeout_at && new Date() > new Date(offer.timeout_at)) {
      // Mark as timed_out (best effort)
      await supabase
        .from('dispatch_offers')
        .update({ status: 'timed_out', responded_at: new Date().toISOString() })
        .eq('id', offerId);

      return NextResponse.json(
        { error: 'หมดเวลาตอบรับ Offer แล้ว' },
        { status: 409 }
      );
    }

    const respondedAt = new Date().toISOString();
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Online-First (§6): รับงานได้เฉพาะตอนที่ยังมี Work Session เปิดอยู่เท่านั้น
    if (action === 'accept') {
      const { data: openSession } = await supabase
        .from('rider_work_sessions')
        .select('id')
        .eq('rider_id', rider.id)
        .eq('status', 'open')
        .maybeSingle();

      if (!openSession) {
        return NextResponse.json(
          { error: 'ต้องกด "เริ่มงาน" ก่อนจึงจะรับงานได้' },
          { status: 403 }
        );
      }
    }

    if (action === 'accept') {
      // 4a. Accept: Compare-and-Swap — ต้องได้แถวกลับมาจริงถึงถือว่ารับงานสำเร็จ
      // (supabase-js ไม่ error เมื่อ update ไม่โดนแถวไหนเลย จึงต้องเช็คด้วย .select())
      const { data: claimedOffer, error: updateOfferError } = await supabase
        .from('dispatch_offers')
        .update({ status: 'accepted', responded_at: respondedAt })
        .eq('id', offerId)
        .eq('status', 'offered') // Double-check ป้องกัน race condition
        .select('id');

      if (updateOfferError || !claimedOffer || claimedOffer.length === 0) {
        return NextResponse.json(
          { error: 'งานนี้ถูกจ่ายให้ไรเดอร์คนอื่นหรือหมดเวลาไปแล้ว' },
          { status: 409 }
        );
      }

      // Assign rider ให้ order (ต้องยังไม่มีคนรับเท่านั้น)
      const { data: assignedOrder, error: assignError } = await supabase
        .from('orders')
        .update({
          assigned_rider_id: rider.id,
          dispatch_status: 'assigned',
        })
        .eq('id', offer.order_id)
        .is('assigned_rider_id', null)
        .in('dispatch_status', ['pending', 'dispatching'])
        .select('id');

      if (assignError || !assignedOrder || assignedOrder.length === 0) {
        console.error('[offer/respond] Assign rider failed:', assignError);
        // Rollback offer เพื่อให้รอบ dispatch ถัดไปทำงานต่อได้
        await supabase
          .from('dispatch_offers')
          .update({ status: 'offered', responded_at: null })
          .eq('id', offerId);

        return NextResponse.json(
          { error: 'งานนี้ถูกจ่ายให้ไรเดอร์คนอื่นแล้ว' },
          { status: 409 }
        );
      }
    } else {
      // 4b. Reject: อัปเดต offer เท่านั้น (Dispatch Engine จะหาคนถัดไป)
      const { data: rejectedOffer, error: updateError } = await supabase
        .from('dispatch_offers')
        .update({ status: 'rejected', responded_at: respondedAt })
        .eq('id', offerId)
        .eq('status', 'offered')
        .select('id');

      if (updateError || !rejectedOffer || rejectedOffer.length === 0) {
        return NextResponse.json(
          { error: 'ไม่สามารถปฏิเสธงานได้ (อาจหมดเวลาไปแล้ว)' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      responded_at: respondedAt,
    });
  } catch (err) {
    console.error('[offer/respond] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
