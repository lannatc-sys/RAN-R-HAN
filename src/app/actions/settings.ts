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

const serviceAreaSettingsSchema = z.object({
  shop_id: z.string().uuid(),
  service_area_enabled: z.boolean(),
  service_radius_m: z.number().finite().positive().max(200000),
  rider_work_radius_m: z.number().finite().positive().max(200000),
});

export async function updateServiceAreaSettingsAction(data: {
  shop_id: string;
  service_area_enabled: boolean;
  service_radius_m: number;
  rider_work_radius_m: number;
}): Promise<{
  success: boolean;
  settings?: {
    service_area_enabled: boolean;
    service_radius_m: number;
    rider_work_radius_m: number;
  };
  error?: string;
}> {
  const validated = serviceAreaSettingsSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: 'ข้อมูลขอบเขตบริการไม่ถูกต้อง' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขการตั้งค่า' };
    }

    const { data: result, error } = await supabase.rpc('set_shop_service_area_settings', {
      p_shop_id: validated.data.shop_id,
      p_enabled: validated.data.service_area_enabled,
      p_service_radius_m: validated.data.service_radius_m,
      p_rider_work_radius_m: validated.data.rider_work_radius_m,
    });

    if (error) {
      return { success: false, error: formatThaiError(error) };
    }

    const settings = result as {
      service_area_enabled: boolean;
      service_radius_m: number;
      rider_work_radius_m: number;
    };
    safeRevalidate('/admin/service-area');

    return { success: true, settings };
  } catch (error: unknown) {
    return { success: false, error: formatThaiError(error) };
  }
}

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
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขการตั้งค่า' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: data.shop_id,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์แก้ไขการตั้งค่าของร้านนี้' };
    }

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
      return { success: false, error: formatThaiError(error) };
    }

    safeRevalidate('/admin/settings');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatThaiError(error) };
  }
}

/**
 * อนุญาตให้ทีมงาน Support / Superadmin เข้าถึงข้อมูลยอดขายชั่วคราว (24 หรือ 48 ชั่วโมง)
 */
export async function grantSupportAccessAction(
  shopId: string,
  hours: 24 | 48 = 24
): Promise<{ success: boolean; expiresAt?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: shopId,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการข้อมูลของร้านค้านี้' };
    }

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
    return { success: false, error: formatThaiError(err) };
  }
}

/**
 * ยกเลิกสิทธิ์การเข้าถึงข้อมูลยอดขายของทีมงานทันที
 */
export async function revokeSupportAccessAction(
  shopId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: shopId,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการข้อมูลของร้านค้านี้' };
    }

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
    return { success: false, error: formatThaiError(err) };
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
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนบันทึกการตั้งค่า' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: data.shop_id,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการข้อมูลของร้านค้านี้' };
    }

    // ตรวจสอบ allowlist โดเมนสำหรับ api_url
    if (data.api_url && data.api_url.trim().length > 0) {
      const rawUrl = data.api_url.trim();
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`);
      } catch {
        return { success: false, error: 'รูปแบบ API URL ไม่ถูกต้อง' };
      }

      // ต้องใช้ HTTPS เท่านั้น เพื่อป้องกัน API Key รั่วไหลผ่าน HTTP plaintext
      if (parsedUrl.protocol !== 'https:') {
        return { success: false, error: 'API URL ต้องใช้ HTTPS เท่านั้น' };
      }

      if (parsedUrl.hostname !== 'api.slipok.com') {
        return { success: false, error: 'API URL ต้องเป็นโดเมน api.slipok.com เท่านั้น' };
      }
    }

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
      return { success: false, error: formatThaiError(error) };
    }

    safeRevalidate('/admin/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatThaiError(err) };
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

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: data.shop_id,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการข้อมูลของร้านค้านี้' };
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
      return { success: false, error: formatThaiError(error) };
    }

    safeRevalidate('/admin/settings');
    safeRevalidate('/admin/orders');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatThaiError(err) };
  }
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
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: data.shop_id,
    });
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการข้อมูลของร้านค้านี้' };
    }

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
      return { success: false, error: formatThaiError(error) };
    }

    safeRevalidate('/admin/settings');
    safeRevalidate('/[slug]');
    safeRevalidate('/[slug]/checkout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatThaiError(err) };
  }
}

/**
 * อัปเดตพิกัดที่ตั้งร้านค้า (shop_lat, shop_lng) สำหรับระบบจัดส่งและค้นหาไรเดอร์
 * ใช้ RPC update_shop_geo ซึ่งจัดการ lock, re-evaluate rider timers,
 * และตรวจสิทธิ์ผ่าน has_shop_access() ในฐานข้อมูล
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

    // --- Input Validation first (cheap, no I/O, testable without request scope) ---
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

    // --- DB-authoritative RPC: auth + lock + rider re-evaluation in one transaction ---
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนแก้ไขการตั้งค่า' };
    }

    const { error } = await supabase.rpc('update_shop_geo', {
      p_shop_id: shop_id,
      p_shop_lat: hasLat ? shop_lat : null,
      p_shop_lng: hasLng ? shop_lng : null,
    });

    if (error) {
      return { success: false, error: formatThaiError(error) };
    }

    safeRevalidate('/admin/settings');
    safeRevalidate('/admin/service-area');
    return { success: true };
  } catch (err: any) {
    console.error('updateShopGeoAction error:', err);
    return { success: false, error: formatThaiError(err) };
  }
}

