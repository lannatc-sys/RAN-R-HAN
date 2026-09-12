'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { encryptApiKey } from '@/lib/crypto';
import { formatThaiError } from '@/lib/thai-errors';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore when called outside HTTP request lifecycle
  }
}

const shopOpenStatusSchema = z.object({
  shop_id: z.string().uuid(),
  is_open: z.boolean(),
});

/**
 * เปิดหรือปิดรับออเดอร์ของร้านผ่าน RPC ที่ตรวจสิทธิ์สมาชิกของร้าน
 * ใช้ session-bound client เพื่อให้ auth.uid() พร้อมสำหรับ has_shop_access().
 */
export async function updateShopOpenStatusAction(data: {
  shop_id: string;
  is_open: boolean;
}): Promise<{ success: boolean; isOpen?: boolean; error?: string }> {
  const validated = shopOpenStatusSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: 'ข้อมูลสถานะร้านไม่ถูกต้อง' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนเปลี่ยนสถานะร้าน' };
    }

    const { data: result, error } = await supabase.rpc('set_shop_open_status', {
      p_shop_id: validated.data.shop_id,
      p_is_open: validated.data.is_open,
    });

    if (error) {
      return { success: false, error: formatThaiError(error) };
    }

    const response = result as { slug?: string; is_open?: boolean } | null;
    safeRevalidate('/admin/settings');
    if (response?.slug) {
      safeRevalidate(`/${response.slug}`);
      safeRevalidate(`/${response.slug}/checkout`);
    }

    return {
      success: true,
      isOpen: response?.is_open ?? validated.data.is_open,
    };
  } catch (error: unknown) {
    return { success: false, error: formatThaiError(error) };
  }
}

export async function updateShopSettingsAction(data: {
  shop_id: string;
  name: string;
  promptpay_id: string;
  promptpay_name: string;
  service_charge: number;
  vat_mode: 'none' | 'inclusive' | 'exclusive';
}) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('shops')
    .update({
      name: data.name,
      promptpay_id: data.promptpay_id || null,
      promptpay_name: data.promptpay_name || null,
      service_charge: data.service_charge,
      vat_mode: data.vat_mode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.shop_id);

  if (error) {
    return { success: false, error: error.message };
  }

  safeRevalidate('/admin/settings');
  return { success: true };
}

/**
 * อนุญาตให้ทีมงาน Support / Superadmin เข้าถึงข้อมูลยอดขายชั่วคราว (24 หรือ 48 ชั่วโมง)
 */
export async function grantSupportAccessAction(
  shopId: string,
  hours: 24 | 48 = 24
): Promise<{ success: boolean; expiresAt?: string; error?: string }> {
  try {
    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const { error } = await admin
      .from('shops')
      .update({
        support_access_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) throw error;

    safeRevalidate('/admin/settings');
    safeRevalidate('/admin/orders');
    return { success: true, expiresAt };
  } catch (err: any) {
    console.error('grantSupportAccessAction error:', err);
    return { success: false, error: err.message || 'Failed to grant support access' };
  }
}

/**
 * ยกเลิกสิทธิ์การเข้าถึงข้อมูลยอดขายของทีมงานทันที
 */
export async function revokeSupportAccessAction(
  shopId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from('shops')
      .update({
        support_access_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) throw error;

    safeRevalidate('/admin/settings');
    safeRevalidate('/admin/orders');
    return { success: true };
  } catch (err: any) {
    console.error('revokeSupportAccessAction error:', err);
    return { success: false, error: err.message || 'Failed to revoke support access' };
  }
}

/**
 * บันทึก API URL และ API Key ของผู้ให้บริการตรวจสลิป (SlipOK)
 * โดย API Key จะถูกเข้ารหัสด้วย AES-256-GCM (Write-only)
 * ห้ามส่งค่า decrypted กลับไปยัง client เด็ดขาด
 */
export async function saveSlipCredentialsAction(data: {
  shop_id: string;
  provider: string;
  api_url?: string;
  api_key: string;
}) {
  if (!data.api_key || data.api_key.trim().length === 0) {
    return { success: false, error: 'กรุณาระบุ SLIPOK_API_KEY' };
  }

  try {
    // เข้ารหัสด้วย AES-256-GCM ฝั่ง server
    const encryptedBuffer = encryptApiKey(data.api_key.trim());
    const admin = createAdminClient();

    const { error } = await admin.from('shop_payment_credentials').upsert(
      {
        shop_id: data.shop_id,
        slip_check_provider: data.provider || 'slipok',
        api_url: data.api_url?.trim() || null,
        api_key_encrypted: encryptedBuffer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id' }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to encrypt and save credentials' };
  }
}

/**
 * อัปเดตรหัสความปลอดภัย PIN 4 หลักสำหรับ KDS และตั้งค่าร้านค้า
 */
export async function updateKdsPinAction(data: {
  shop_id: string;
  current_pin?: string;
  new_pin: string;
}) {
  if (!data.new_pin || !/^\d{4}$/.test(data.new_pin)) {
    return { success: false, error: 'รหัส PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น' };
  }

  const admin = createAdminClient();

  // ตรวจสอบ PIN เดิมถ้าส่งมา
  if (data.current_pin !== undefined) {
    const { data: shop } = await admin
      .from('shops')
      .select('kds_pin')
      .eq('id', data.shop_id)
      .single();

    if (shop && (shop.kds_pin || '0000') !== data.current_pin) {
      return { success: false, error: 'รหัส PIN เดิมไม่ถูกต้อง' };
    }
  }

  const { error } = await admin
    .from('shops')
    .update({
      kds_pin: data.new_pin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.shop_id);

  if (error) {
    return { success: false, error: error.message };
  }

  safeRevalidate('/admin/settings');
  safeRevalidate('/admin/orders');
  return { success: true };
}

/**
 * อัปเดตการเปิด-ปิดช่องทางการให้บริการ (Dine-in, Takeaway, Delivery)
 */
export async function updateFulfillmentChannelsAction(data: {
  shop_id: string;
  allow_dine_in: boolean;
  allow_takeaway: boolean;
  allow_delivery: boolean;
}) {
  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from('shops')
      .update({
        allow_dine_in: data.allow_dine_in,
        allow_takeaway: data.allow_takeaway,
        allow_delivery: data.allow_delivery,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.shop_id);

    if (error) {
      return { success: false, error: error.message };
    }

    safeRevalidate('/admin/settings');
    safeRevalidate('/[slug]');
    safeRevalidate('/[slug]/checkout');
    return { success: true };
  } catch (err: any) {
    console.error('updateFulfillmentChannelsAction error:', err);
    return { success: false, error: err.message || 'Failed to update channels' };
  }
}

/**
 * อัปเดตพิกัดที่ตั้งร้านค้า (shop_lat, shop_lng) สำหรับระบบจัดส่งและค้นหาไรเดอร์
 */
export async function updateShopGeoAction(data: {
  shop_id: string;
  shop_lat: number | null;
  shop_lng: number | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { shop_id, shop_lat, shop_lng } = data;

    if (!shop_id) {
      return { success: false, error: 'ไม่พบรหัสร้านค้า' };
    }

    // Validation: ต้องระบุทั้งคู่ หรือเว้นว่างทั้งคู่
    const hasLat = shop_lat !== null && shop_lat !== undefined && !isNaN(shop_lat);
    const hasLng = shop_lng !== null && shop_lng !== undefined && !isNaN(shop_lng);

    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      return { success: false, error: 'กรุณาระบุทั้งละติจูด (Latitude) และลองจิจูด (Longitude) ให้ครบถ้วน' };
    }

    if (hasLat && hasLng) {
      if (shop_lat! < -90 || shop_lat! > 90) {
        return { success: false, error: 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90 องศา' };
      }
      if (shop_lng! < -180 || shop_lng! > 180) {
        return { success: false, error: 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180 องศา' };
      }
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('shops')
      .update({
        shop_lat: hasLat ? shop_lat : null,
        shop_lng: hasLng ? shop_lng : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shop_id);

    if (error) {
      return { success: false, error: error.message };
    }

    safeRevalidate('/admin/settings');
    return { success: true };
  } catch (err: any) {
    console.error('updateShopGeoAction error:', err);
    return { success: false, error: err.message || 'Failed to update shop coordinates' };
  }
}
