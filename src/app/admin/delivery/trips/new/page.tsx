import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewTripClient } from './NewTripClient';

export default async function NewTripPage() {
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <NewTripClient shopId={shopId} />
    </div>
  );
}
