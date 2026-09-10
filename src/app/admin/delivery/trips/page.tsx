import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDeliveryTripsAction } from '@/app/actions/delivery';
import { TripsClient } from './TripsClient';
import { DeliverySubNav } from '@/components/admin/delivery/DeliverySubNav';

export default async function DeliveryTripsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('shop_id')
    .eq('id', user.id)
    .single();

  const shopId = userData?.shop_id || '';
  const tripsRes = await getDeliveryTripsAction(shopId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <DeliverySubNav />
      <TripsClient trips={tripsRes.data || []} />
    </div>
  );
}
