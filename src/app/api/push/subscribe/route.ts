import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED: กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = await req.json();
    const { shop_id, subscription } = body;

    if (!shop_id || !subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'INVALID_PAYLOAD: ข้อมูลการแจ้งเตือนไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // บันทึกหรืออัปเดต push_subscriptions
    const { error: dbError } = await admin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        shop_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
