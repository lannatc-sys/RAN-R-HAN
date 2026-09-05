import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { MenuClient } from './MenuClient';
import { Shop, Category, MenuItem } from '@/lib/types';

interface ShopPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { slug } = await params;
  const admin = createAdminClient();

  // 1. ดึงข้อมูลร้านค้าที่ active
  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('status', 'active')
    .single();

  if (shopError || !shop) {
    notFound();
  }

  // 2. ดึงหมวดหมู่เรียงตาม sort_order
  const { data: categories } = await admin
    .from('categories')
    .select('*')
    .eq('shop_id', shop.id)
    .order('sort_order', { ascending: true });

  // 3. ดึงรายการเมนูที่พร้อมขาย พร้อม options
  const { data: menuItems } = await admin
    .from('menu_items')
    .select(`
      *,
      options (*)
    `)
    .eq('shop_id', shop.id)
    .eq('is_available', true)
    .order('sort_order', { ascending: true });

  return (
    <MenuClient
      shop={shop as Shop}
      categories={(categories || []) as Category[]}
      menuItems={(menuItems || []) as MenuItem[]}
    />
  );
}
