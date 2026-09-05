import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OrdersKDSClient } from './OrdersKDSClient';
import { Order, Shop } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function AdminOrdersPage() {
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

  // Fallback to first shop for dev review if not logged in
  if (!shopId) {
    const { data: defaultShop } = await admin.from('shops').select('id').limit(1).maybeSingle();
    shopId = defaultShop?.id || null;
  }

  if (!shopId) {
    redirect('/login');
  }

  const { data: shop } = await admin.from('shops').select('*').eq('id', shopId).single();

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
    />
  );
}
