import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MenuManagementClient } from './MenuManagementClient';
import { Shop, Category, MenuItem } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function AdminMenuPage() {
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
    const { data: defaultShop } = await admin.from('shops').select('id').limit(1).single();
    shopId = defaultShop?.id || null;
  }

  if (!shopId) {
    redirect('/login');
  }

  const { data: shop } = await admin.from('shops').select('*').eq('id', shopId).single();

  const { data: categories } = await admin
    .from('categories')
    .select('*')
    .eq('shop_id', shopId)
    .order('sort_order', { ascending: true });

  const { data: menuItems } = await admin
    .from('menu_items')
    .select('*')
    .eq('shop_id', shopId)
    .order('sort_order', { ascending: true });

  return (
    <MenuManagementClient
      shop={shop as Shop}
      categories={(categories || []) as Category[]}
      initialMenuItems={(menuItems || []) as MenuItem[]}
    />
  );
}
