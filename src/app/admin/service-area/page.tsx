import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkIsSuperadmin } from '@/app/actions/superadmin';
import type { Shop } from '@/lib/types';
import { ServiceAreaSettingsClient } from './ServiceAreaSettingsClient';

export default async function ServiceAreaSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  let shopId: string | null = null;
  const impersonatedShopId = (await cookies()).get('impersonated_shop_id')?.value;

  if (impersonatedShopId) {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (isSuperadmin) shopId = impersonatedShopId;
  }

  if (!shopId && user) {
    const { data: profile } = await admin
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();
    shopId = profile?.shop_id ?? null;
  }

  if (!shopId) redirect('/login');

  const { data: shop } = await admin
    .from('shops')
    .select('id, name, shop_lat, shop_lng, service_area_enabled, service_radius_m, rider_work_radius_m')
    .eq('id', shopId)
    .single();

  if (!shop) redirect('/login');

  return <ServiceAreaSettingsClient shop={shop as Shop} />;
}
