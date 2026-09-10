import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { SettingsClient } from './SettingsClient';
import { Shop } from '@/lib/types';
import { redirect } from 'next/navigation';
import { checkIsSuperadmin } from '@/app/actions/superadmin';

export default async function AdminSettingsPage() {
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

  // ตรวจสอบว่าร้านนี้มีการตั้งค่า API key ไว้แล้วหรือไม่ (ไม่ดึง api_key_encrypted ออกมา)
  const { data: creds } = await admin
    .from('shop_payment_credentials')
    .select('slip_check_provider, api_url')
    .eq('shop_id', shopId)
    .maybeSingle();

  // ดึงยอดขายวันนี้ (Today's Sales Report)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayOrders } = await admin
    .from('orders')
    .select('id, total, status')
    .eq('shop_id', shopId)
    .gte('created_at', todayStart.toISOString())
    .neq('status', 'cancelled');

  const validOrders = (todayOrders || []).filter((o) =>
    ['confirmed', 'cooking', 'served', 'completed'].includes(o.status)
  );
  const todaySales = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const todayOrderCount = validOrders.length;

  return (
    <SettingsClient
      shop={shop as Shop}
      hasSlipCredentials={!!creds}
      slipProvider={creds?.slip_check_provider || 'slipok'}
      initialApiUrl={creds?.api_url || ''}
      todaySales={todaySales}
      todayOrderCount={todayOrderCount}
      isPrivacyMode={isPrivacyMode}
    />
  );
}
