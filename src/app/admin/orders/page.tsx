import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { OrdersKDSClient } from './OrdersKDSClient';
import { Order, Shop } from '@/lib/types';
import { redirect } from 'next/navigation';
import { checkIsSuperadmin } from '@/app/actions/superadmin';

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const cookieStore = await cookies();
  const impersonatedShopId = cookieStore.get('impersonated_shop_id')?.value;

  let shopId: string | null = null;
  let isImpersonated = false;

  if (impersonatedShopId) {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (isSuperadmin) {
      shopId = impersonatedShopId;
      isImpersonated = true;
    }
  }

  if (!shopId && user) {
    const { data: userProfile } = await admin
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();
    shopId = userProfile?.shop_id || null;
  }

  if (!shopId) {
    redirect('/login');
  }

  const { data: shop } = await admin.from('shops').select('*').eq('id', shopId).single();

  const hasSupportConsent = Boolean(
    shop?.support_access_expires_at &&
    new Date(shop.support_access_expires_at) > new Date()
  );
  const isPrivacyMode = isImpersonated && !hasSupportConsent;

  const { data: orders } = await admin
    .from('orders')
    .select(`
      *,
      order_items (*),
      payments (*)
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <OrdersKDSClient
      initialOrders={(orders || []) as Order[]}
      shop={shop as Shop}
      isPrivacyMode={isPrivacyMode}
    />
  );
}
