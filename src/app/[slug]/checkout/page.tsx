import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { CheckoutClient } from './CheckoutClient';
import { Shop } from '@/lib/types';

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: shop, error } = await admin
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('status', 'active')
    .single();

  if (error || !shop) {
    notFound();
  }

  return <CheckoutClient shop={shop as Shop} />;
}
