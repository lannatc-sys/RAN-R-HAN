import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDeliveryLocationsAction } from '@/app/actions/delivery';
import { LocationsClient } from './LocationsClient';
import { DeliverySubNav } from '@/components/admin/delivery/DeliverySubNav';

export default async function DeliveryLocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get current user shop_id
  const { data: userData } = await supabase
    .from('users')
    .select('shop_id')
    .eq('id', user.id)
    .single();

  const shopId = userData?.shop_id || '';
  const locationsRes = await getDeliveryLocationsAction(shopId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <DeliverySubNav />
      <LocationsClient
        initialLocations={locationsRes.data || []}
        shopId={shopId}
      />
    </div>
  );
}
