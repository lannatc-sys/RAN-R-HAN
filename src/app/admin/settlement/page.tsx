import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkIsSuperadmin } from '@/app/actions/superadmin';
import { SettlementClient } from './SettlementClient';

export const metadata = {
  title: 'Daily Settlement — RAN-R-HAN Admin',
};

export default async function SettlementPage() {
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

  // ดึง Settlement ล่าสุด 30 วัน
  const { data: settlements } = await admin
    .from('daily_settlements')
    .select('*')
    .eq('shop_id', shopId)
    .order('settlement_date', { ascending: false })
    .limit(30);

  // Settlement วันนี้ (ถ้ามี)
  const today = new Date().toISOString().split('T')[0];
  const todaySettlement = (settlements ?? []).find((s) => s.settlement_date === today);

  return (
    <SettlementClient
      shopId={shopId}
      settlements={settlements ?? []}
      todaySettlement={todaySettlement ?? null}
    />
  );
}
