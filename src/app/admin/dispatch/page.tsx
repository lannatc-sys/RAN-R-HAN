import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkIsSuperadmin } from '@/app/actions/superadmin';
import { DispatchMonitorClient } from './DispatchMonitorClient';

export const metadata = {
  title: 'Dispatch Monitor — RAN-R-HAN Admin',
};

export default async function DispatchPage() {
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

  // Orders ที่กำลัง Dispatch อยู่
  const { data: activeOrders } = await admin
    .from('orders')
    .select(`
      id, order_no, dispatch_status, delivery_address, created_at,
      assigned_rider_id,
      riders:assigned_rider_id (display_name, phone)
    `)
    .eq('shop_id', shopId)
    .in('dispatch_status', ['pending', 'dispatching', 'assigned', 'in_transit'])
    .order('created_at', { ascending: false })
    .limit(50);

  // Offers ล่าสุด (รวม timeout/reject)
  const { data: recentOffers } = await admin
    .from('dispatch_offers')
    .select(`
      id, order_id, status, dispatch_round, offered_at, responded_at, timeout_at,
      riders:rider_id (display_name, phone)
    `)
    .eq('shop_id', shopId)
    .order('offered_at', { ascending: false })
    .limit(30);

  // ไรเดอร์ที่ออนไลน์อยู่
  const { data: onlineRiders } = await admin
    .from('rider_current_locations')
    .select(`
      rider_id, lat, lng, updated_at,
      riders:rider_id (display_name, phone, status)
    `)
    .eq('shop_id', shopId);

  return (
    <DispatchMonitorClient
      shopId={shopId}
      activeOrders={activeOrders ?? []}
      recentOffers={recentOffers ?? []}
      onlineRiders={onlineRiders ?? []}
    />
  );
}
