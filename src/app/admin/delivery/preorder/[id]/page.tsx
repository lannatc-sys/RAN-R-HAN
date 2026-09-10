import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getPreorderRoundDetailAction, getDeliveryLocationsAction } from '@/app/actions/delivery';
import { PreorderRoundDetailClient } from './PreorderRoundDetailClient';

interface PreorderRoundDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PreorderRoundDetailPage({ params }: PreorderRoundDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('shop_id')
    .eq('id', user.id)
    .single();

  const shopId = userData?.shop_id || '';

  const [roundRes, locationsRes] = await Promise.all([
    getPreorderRoundDetailAction(id),
    getDeliveryLocationsAction(shopId),
  ]);

  if (!roundRes.success || !roundRes.round) {
    redirect('/admin/delivery/preorder');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PreorderRoundDetailClient
        initialRound={roundRes.round}
        initialItems={roundRes.items || []}
        availableLocations={locationsRes.data || []}
      />
    </div>
  );
}
