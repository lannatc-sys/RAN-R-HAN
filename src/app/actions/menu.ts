'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleMenuItemAvailabilityAction(itemId: string, currentAvailable: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('menu_items')
    .update({ is_available: !currentAvailable })
    .eq('id', itemId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  return { success: true };
}

export async function createMenuItemAction(data: {
  shop_id: string;
  category_id: string | null;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('menu_items').insert({
    shop_id: data.shop_id,
    category_id: data.category_id || null,
    name: data.name,
    price: data.price,
    description: data.description || null,
    image_url: data.image_url || null,
    is_available: true,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  return { success: true };
}

export async function createCategoryAction(shopId: string, name: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('categories').insert({
    shop_id: shopId,
    name,
    sort_order: 99,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  return { success: true };
}
