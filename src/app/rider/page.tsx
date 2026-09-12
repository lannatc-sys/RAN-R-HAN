import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RiderClient } from './RiderClient';

export const metadata = {
  title: 'RAN-R-HAN ไรเดอร์',
  description: 'หน้าจอรับงานสำหรับไรเดอร์ RAN-R-HAN',
};

export const dynamic = 'force-dynamic';

export default async function RiderHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/rider/login');

  const { data: rider } = await supabase
    .from('riders')
    .select('id, shop_id, display_name, phone, status, vehicle_type')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const { data: session } = rider
    ? await supabase
        .from('rider_work_sessions')
        .select('id, started_at')
        .eq('rider_id', rider.id)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <RiderClient
      rider={rider ?? null}
      initialSession={session ?? null}
    />
  );
}
