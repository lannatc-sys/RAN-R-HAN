import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getPreorderRoundsAction } from '@/app/actions/delivery';
import { PreorderRoundsClient } from './PreorderRoundsClient';
import { DeliverySubNav } from '@/components/admin/delivery/DeliverySubNav';

export default async function PreorderPage() {
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
  const roundsRes = await getPreorderRoundsAction(shopId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <DeliverySubNav />
      <PreorderRoundsClient rounds={roundsRes.data || []} />
    </div>
  );
}
