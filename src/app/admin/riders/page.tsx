import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkIsSuperadmin } from '@/app/actions/superadmin';
import { RidersClient } from './RidersClient';

export const metadata = {
  title: 'จัดการไรเดอร์ — RAN-R-HAN Admin',
};

export default async function RidersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const cookieStore = await cookies();
  const impersonatedShopId = cookieStore.get('impersonated_shop_id')?.value;

  let shopId: string | null = null;

  if (impersonatedShopId) {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (isSuperadmin) shopId = impersonatedShopId;
  }

  if (!shopId && user) {
    const { data: userProfile } = await admin
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();
    shopId = userProfile?.shop_id || null;
  }

  if (!shopId) redirect('/login');

  // ดึงรายชื่อไรเดอร์ทั้งหมดของร้าน
  const { data: riders } = await admin
    .from('riders')
    .select(`
      id,
      display_name,
      phone,
      vehicle_type,
      status,
      performance_score,
      created_at,
      auth_user_id,
      telegram_chat_id,
      push_enabled
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  // ดึงสถานะ Online (มี work_session open อยู่)
  const { data: openSessions } = await admin
    .from('rider_work_sessions')
    .select('rider_id, started_at')
    .eq('shop_id', shopId)
    .eq('status', 'open');

  const onlineRiderIds = new Set((openSessions ?? []).map((s) => s.rider_id));

  const ridersWithStatus = (riders ?? []).map((r) => ({
    ...r,
    is_online: onlineRiderIds.has(r.id),
  }));

  return <RidersClient riders={ridersWithStatus} shopId={shopId} />;
}
