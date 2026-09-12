import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface OfferResponseResult {
  success: boolean;
  code?: string;
  status?: 'accepted' | 'rejected';
  responded_at?: string;
}

function rpcErrorStatus(message: string): number {
  if (message.includes('OFFER_NOT_FOUND')) return 404;
  if (message.includes('OFFER_FORBIDDEN') || message.includes('WORK_SESSION_REQUIRED')) return 403;
  if (message.includes('INVALID_OFFER_ACTION')) return 400;
  return 409;
}

/**
 * POST /api/rider/offer/[offerId]/respond
 * The database RPC locks and validates the offer, rider session and order in one
 * transaction so a client cannot bypass timeout or double-assignment guards.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const supabase = await createClient();
    const { offerId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;
    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action ต้องเป็น "accept" หรือ "reject" เท่านั้น' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('respond_to_dispatch_offer', {
      p_offer_id: offerId,
      p_action: action,
    });

    if (error) {
      console.error('[offer/respond] RPC error:', error.code);
      return NextResponse.json(
        { error: 'ไม่สามารถตอบรับงานได้ สถานะงานอาจเปลี่ยนไปแล้ว' },
        { status: rpcErrorStatus(error.message) }
      );
    }

    const result = data as OfferResponseResult;
    if (!result.success && result.code === 'OFFER_EXPIRED') {
      return NextResponse.json({ error: 'หมดเวลาตอบรับ Offer แล้ว' }, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[offer/respond] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
