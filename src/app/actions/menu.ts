'use server';

import { createAdminClient } from '@/lib/supabase/admin';
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

export async function updateMenuItemAction(data: {
  id: string;
  name?: string;
  price?: number;
  category_id?: string | null;
  description?: string;
  image_url?: string | null;
}) {
  try {
    const admin = createAdminClient();
    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.price !== undefined) updatePayload.price = data.price;
    if (data.category_id !== undefined) updatePayload.category_id = data.category_id || null;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.image_url !== undefined) updatePayload.image_url = data.image_url;

    const { error } = await admin
      .from('menu_items')
      .update(updatePayload)
      .eq('id', data.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/menu');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMenuItemAction(itemId: string) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('menu_items').delete().eq('id', itemId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/menu');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function uploadMenuImageAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('file') as File;
    const shopId = (formData.get('shop_id') as string) || 'common';

    if (!file) {
      return { success: false, error: 'ไม่พบไฟล์รูปภาพ' };
    }

    // ตรวจสอบชนิดไฟล์
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF)' };
    }

    // จำกัดขนาดไฟล์ไม่เกิน 5MB
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB' };
    }

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ดึงนามสกุลไฟล์
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${shopId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = `menu/${filename}`;

    const { error: uploadError } = await admin.storage
      .from('shop-assets')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: publicUrlData } = admin.storage
      .from('shop-assets')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' };
  }
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
