import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SettingsClient } from './SettingsClient';
import { Shop } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  let shopId: string | null = null;
  if (user) {
    const { data: userProfile } = await admin
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();
    shopId = userProfile?.shop_id || null;
  }

  if (!shopId) {
    const { data: defaultShop } = await admin.from('shops').select('id').limit(1).maybeSingle();
    shopId = defaultShop?.id || null;
  }

  if (!shopId) {
    redirect('/login');
  }

  const { data: shop } = await admin.from('shops').select('*').eq('id', shopId).single();

  // ตรวจสอบว่าร้านนี้มีการตั้งค่า API key ไว้แล้วหรือไม่ (ไม่ดึง api_key_encrypted ออกมา)
  const { data: creds } = await admin
    .from('shop_payment_credentials')
    .select('slip_check_provider')
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
      todaySales={todaySales}
      todayOrderCount={todayOrderCount}
    />
  );
}
