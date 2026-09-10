import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDeliveryTripDetailAction, getDeliveryLocationsAction } from '@/app/actions/delivery';
import { TripDetailClient } from './TripDetailClient';

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
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

  const [tripRes, locationsRes] = await Promise.all([
    getDeliveryTripDetailAction(id),
    getDeliveryLocationsAction(shopId),
  ]);

  if (!tripRes.success || !tripRes.trip) {
    redirect('/admin/delivery/trips');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <TripDetailClient
        initialTrip={tripRes.trip}
        initialItems={tripRes.items || []}
        availableLocations={locationsRes.data || []}
      />
    </div>
  );
}
