'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { PlatformStats, Shop, ShopStatus } from '@/lib/types';

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore when called outside of Next.js HTTP request lifecycle (e.g. CLI test runners)
  }
}

/**
 * ตรวจสอบสิทธิ์ผู้ดูแลระบบสูงสุด (Superadmin)
 */
export async function checkIsSuperadmin(): Promise<{ isSuperadmin: boolean; user: any | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { isSuperadmin: false, user: null };
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'superadmin') {
      return { isSuperadmin: true, user };
    }

    // 1. ตรวจสอบสิทธิ์จาก Environment Variable (SUPER_ADMIN_USER หรือ SUPER_ADMIN)
    const superAdminEnv = process.env.SUPER_ADMIN_USER || process.env.SUPER_ADMIN;
    if (superAdminEnv && user.email) {
      const allowedEmails = superAdminEnv
        .split(',')
        .map((e) => e.trim().toLowerCase());

      const userEmail = user.email.toLowerCase().trim();
      if (allowedEmails.includes(userEmail)) {
        // อัปเดต role ใน public.users ให้เป็น superadmin ทันที
        await admin.from('users').upsert({
          id: user.id,
          role: 'superadmin',
          full_name: user.user_metadata?.full_name || userEmail.split('@')[0],
          updated_at: new Date().toISOString(),
        });
        return { isSuperadmin: true, user };
      }
    }

    // 2. หากยังไม่มี superadmin ใดๆ ในระบบเลย ให้บัญชีแรกที่เข้ามาสามารถเป็น superadmin ได้
    const { count } = await admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'superadmin');

    if (count === 0) {
      // แต่งตั้งผู้ใช้นี้เป็น Superadmin คนแรกอัตโนมัติ
      await admin.from('users').upsert({
        id: user.id,
        role: 'superadmin',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Superadmin',
      });
      return { isSuperadmin: true, user };
    }

    return { isSuperadmin: false, user };
  } catch (error) {
    console.error('checkIsSuperadmin error:', error);
    return { isSuperadmin: false, user: null };
  }
}

/**
 * ดึงสถิติภาพรวมแพลตฟอร์มทั้งหมด (Platform Stats)
 */
export async function getPlatformStatsAction(): Promise<{
  success: boolean;
  stats?: PlatformStats;
  error?: string;
}> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    // 1. สถิติจำนวนร้านค้า
    const { data: shops, error: shopsErr } = await admin
      .from('shops')
      .select('id, status, is_active');

    if (shopsErr) throw shopsErr;

    const totalStores = shops?.length || 0;
    const activeStores = shops?.filter((s) => s.status === 'active').length || 0;
    const suspendedStores = shops?.filter((s) => s.status === 'suspended').length || 0;

    // 2. สถิติออเดอร์สะสม (ไม่ก้าวล่วงข้อมูลทางการเงิน / GMV - Privacy First)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('id, status, created_at')
      .neq('status', 'cancelled');

    if (ordersErr) throw ordersErr;

    const totalOrders = orders?.length || 0;
    const todayOrders = (orders || []).filter(
      (o) => new Date(o.created_at) >= todayStart
    ).length;

    return {
      success: true,
      stats: {
        totalStores,
        activeStores,
        suspendedStores,
        totalOrders,
        todayOrders,
      },
    };
  } catch (err: any) {
    console.error('getPlatformStatsAction error:', err);
    return { success: false, error: 'โหลดสถิติแพลตฟอร์มไม่สำเร็จ' };
  }
}

/**
 * ดึงรายชื่อร้านค้าทั้งหมด พร้อมตัวกรองค้นหาและสถานะ (ไม่มีข้อมูลยอดขาย GMV เพื่อความเป็นส่วนตัว)
 */
export async function getAllStoresAction(query?: string, statusFilter?: string): Promise<{
  success: boolean;
  stores?: (Shop & { order_count?: number })[];
  error?: string;
}> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    let dbQuery = admin.from('shops').select(`
      *,
      orders (id, status)
    `).order('created_at', { ascending: false });

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      dbQuery = dbQuery.or(`name.ilike.${q},slug.ilike.${q},phone.ilike.${q}`);
    }

    if (statusFilter && statusFilter !== 'all') {
      dbQuery = dbQuery.eq('status', statusFilter);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    const stores = (data || []).map((shop: any) => {
      const validOrders = (shop.orders || []).filter((o: any) => o.status !== 'cancelled');
      const { orders: _, ...shopFields } = shop;
      return {
        ...shopFields,
        order_count: validOrders.length,
      };
    });

    return { success: true, stores };
  } catch (err: any) {
    console.error('getAllStoresAction error:', err);
    return { success: false, error: 'โหลดรายชื่อร้านค้าไม่สำเร็จ' };
  }
}

export interface ShopAreaPin {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
  service_area_enabled: boolean | null;
  service_radius_m: number | null;
  rider_work_radius_m: number | null;
}

/**
 * ร้านทั้งหมดสำหรับชั้นปักหมุดบนแผนที่พื้นที่ให้บริการ
 *
 * เลือกเฉพาะคอลัมน์ที่แผนที่ใช้จริง ไม่ดึงทั้งแถว เพราะ shops เก็บของอย่าง
 * kds_pin และ support_access_expires_at ที่ไม่มีเหตุผลให้ส่งออกไปฝั่ง client
 */
export async function getShopsForAreaMapAction(): Promise<{
  success: boolean;
  shops?: ShopAreaPin[];
  error?: string;
}> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shops')
      .select(
        'id, name, slug, status, shop_lat, shop_lng, service_area_enabled, service_radius_m, rider_work_radius_m'
      )
      .order('name', { ascending: true });

    if (error) throw error;

    // numeric มาเป็นสตริงจาก postgres ผ่าน supabase-js จึงแปลงที่นี่ครั้งเดียว
    const shops: ShopAreaPin[] = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status ?? null,
      shop_lat: s.shop_lat === null ? null : Number(s.shop_lat),
      shop_lng: s.shop_lng === null ? null : Number(s.shop_lng),
      service_area_enabled: s.service_area_enabled ?? null,
      service_radius_m: s.service_radius_m === null ? null : Number(s.service_radius_m),
      rider_work_radius_m:
        s.rider_work_radius_m === null ? null : Number(s.rider_work_radius_m),
    }));

    return { success: true, shops };
  } catch (err: any) {
    console.error('getShopsForAreaMapAction error:', err);
    return { success: false, error: 'โหลดรายชื่อร้านค้าไม่สำเร็จ' };
  }
}

/**
 * ปักหมุดตำแหน่งร้านจากแผนที่ superadmin
 *
 * เรียก update_shop_geo ซึ่งเป็น security definer และตั้งแต่ migration
 * 20260914000002 เป็นต้นไปตรวจ is_superadmin ด่านจริงจึงอยู่ในฐานข้อมูล
 * ไม่ใช่ที่นี่ การตรวจซ้ำข้างล่างมีไว้ให้ข้อความผิดพลาดอ่านรู้เรื่องเท่านั้น
 */
export async function setShopLocationAction(input: {
  shopId: string;
  lat: number;
  lng: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      return { success: false, error: 'พิกัดไม่ถูกต้อง' };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc('update_shop_geo', {
      p_shop_id: input.shopId,
      p_shop_lat: input.lat,
      p_shop_lng: input.lng,
    });

    if (error) throw error;

    revalidatePath('/superadmin/service-area-map');
    return { success: true };
  } catch (err: any) {
    console.error('setShopLocationAction error:', err);
    return { success: false, error: 'ปักหมุดร้านไม่สำเร็จ' };
  }
}

/**
 * บันทึกรูปหลายเหลี่ยมพื้นที่ให้บริการ ส่ง geojson เป็น null เพื่อลบแล้วกลับไปใช้รัศมี
 */
export async function setShopServiceAreaPolygonAction(input: {
  shopId: string;
  kind: 'customer' | 'rider';
  geojson: unknown | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc('set_shop_service_area_polygon', {
      p_shop_id: input.shopId,
      p_kind: input.kind,
      p_geojson: input.geojson,
    });

    if (error) throw error;

    revalidatePath('/superadmin/service-area-map');
    return { success: true };
  } catch (err: any) {
    console.error('setShopServiceAreaPolygonAction error:', err);
    const msg = String(err?.message || '');
    if (msg.includes('INVALID_SERVICE_AREA_POLYGON')) {
      return { success: false, error: 'รูปหลายเหลี่ยมไม่ถูกต้อง เส้นอาจตัดกันเองหรือมีจุดน้อยเกินไป' };
    }
    if (msg.includes('SERVICE_AREA_POLYGON_TOO_LARGE')) {
      return { success: false, error: 'พื้นที่ที่วาดใหญ่เกินเพดานที่ระบบอนุญาต' };
    }
    return { success: false, error: 'บันทึกพื้นที่ไม่สำเร็จ' };
  }
}

/**
 * เปิด/ปิดการจำกัดพื้นที่ และตั้งรัศมี fallback ของร้าน
 *
 * 20260914000002 ย้ายสิทธิ์ RPC นี้ไปเป็น superadmin เท่านั้น และหน้าฝั่งร้าน
 * ถูกปิดปุ่มไปพร้อมกัน ถ้าไม่มี action นี้จะไม่เหลือใครในระบบที่เปิด
 * `service_area_enabled` ได้เลย พื้นที่ที่วาดไว้ก็จะไม่มีวันมีผล
 *
 * ยิง RPC ผ่าน session client ไม่ใช่ admin client เพื่อให้ `is_superadmin()`
 * ในตัว RPC ทำงานเป็นด่านที่สอง และ advisory lock กับลูปปิด session ของไรเดอร์
 * ที่อยู่ใน RPC ยังทำงานครบเหมือนเดิม
 */
export async function setShopServiceAreaSettingsAction(input: {
  shopId: string;
  enabled: boolean;
  serviceRadiusM: number;
  riderWorkRadiusM: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    if (
      !Number.isFinite(input.serviceRadiusM) ||
      !Number.isFinite(input.riderWorkRadiusM) ||
      input.serviceRadiusM <= 0 ||
      input.riderWorkRadiusM <= 0
    ) {
      return { success: false, error: 'รัศมีต้องเป็นตัวเลขมากกว่าศูนย์' };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc('set_shop_service_area_settings', {
      p_shop_id: input.shopId,
      p_enabled: input.enabled,
      p_service_radius_m: input.serviceRadiusM,
      p_rider_work_radius_m: input.riderWorkRadiusM,
    });

    if (error) throw error;

    revalidatePath('/superadmin/service-area-map');
    return { success: true };
  } catch (err: unknown) {
    console.error('setShopServiceAreaSettingsAction error:', err);
    const msg = String((err as { message?: string })?.message || '');
    if (msg.includes('SHOP_COORDINATES_REQUIRED')) {
      return { success: false, error: 'ต้องปักหมุดพิกัดร้านก่อนจึงจะเปิดการจำกัดพื้นที่ได้' };
    }
    if (msg.includes('INVALID_SERVICE_AREA_RADIUS')) {
      return { success: false, error: 'รัศมีอยู่นอกช่วงที่ระบบอนุญาต' };
    }
    if (msg.includes('SHOP_NOT_FOUND')) {
      return { success: false, error: 'ไม่พบร้านค้านี้' };
    }
    if (msg.includes('SHOP_ACCESS_DENIED')) {
      return { success: false, error: 'ไม่มีสิทธิ์ตั้งค่าพื้นที่ของร้านนี้' };
    }
    return { success: false, error: 'บันทึกการตั้งค่าพื้นที่ไม่สำเร็จ' };
  }
}

/**
 * อ่านรูปหลายเหลี่ยมที่ร้านนี้บันทึกไว้ กลับมาเป็น GeoJSON
 *
 * คอลัมน์เป็น geography ซึ่งผ่าน PostgREST มาเป็น WKB hex ใช้ในเบราว์เซอร์ไม่ได้
 * จึงต้องผ่าน RPC ที่แปลงให้
 */
export async function getShopAreaPolygonsAction(shopId: string): Promise<{
  success: boolean;
  customer?: unknown | null;
  rider?: unknown | null;
  error?: string;
}> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_shop_area_polygons', {
      p_shop_id: shopId,
    });

    if (error) throw error;

    const result = (data ?? {}) as { customer?: unknown; rider?: unknown };
    return {
      success: true,
      customer: result.customer ?? null,
      rider: result.rider ?? null,
    };
  } catch (err: any) {
    console.error('getShopAreaPolygonsAction error:', err);
    return { success: false, error: 'โหลดพื้นที่ที่บันทึกไว้ไม่สำเร็จ' };
  }
}

/**
 * อัปเดตสถานะร้านค้า (Active / Suspended / Expired)
 */
export async function updateStoreStatusAction(
  shopId: string,
  status: ShopStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('shops')
      .update({
        status,
        is_active: status === 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) throw error;

    safeRevalidate('/superadmin');
    safeRevalidate('/superadmin/stores');
    return { success: true };
  } catch (err: any) {
    console.error('updateStoreStatusAction error:', err);
    return { success: false, error: 'เปลี่ยนสถานะร้านไม่สำเร็จ' };
  }
}

/**
 * เปลี่ยนแพ็กเกจของร้านค้า (Plan) และขยายวันหมดอายุ
 */
export async function updateStorePlanAction(
  shopId: string,
  plan: string,
  expiresAt?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('shops')
      .update({
        plan,
        plan_expires_at: expiresAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) throw error;

    safeRevalidate('/superadmin');
    safeRevalidate('/superadmin/stores');
    return { success: true };
  } catch (err: any) {
    console.error('updateStorePlanAction error:', err);
    return { success: false, error: 'เปลี่ยนแพ็กเกจร้านไม่สำเร็จ' };
  }
}

/**
 * Superadmin เปิด-ปิดระบบจัดส่งอาหาร (Delivery) ให้ร้านค้าเป็นรายกรณีพิเศษ (Override)
 */
export async function toggleStoreDeliveryOverrideAction(
  shopId: string,
  isEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('shops')
      .update({
        is_delivery_enabled: isEnabled,
        allow_delivery: isEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) throw error;

    safeRevalidate('/superadmin');
    safeRevalidate('/superadmin/stores');
    return { success: true };
  } catch (err: any) {
    console.error('toggleStoreDeliveryOverrideAction error:', err);
    return { success: false, error: 'เปลี่ยนการตั้งค่าจัดส่งไม่สำเร็จ' };
  }
}

/**
 * ลบร้านค้าออกจากระบบอย่างสมบูรณ์ (เฉพาะ Superadmin)
 */
export async function deleteStoreAction(
  shopId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (error) throw error;

    safeRevalidate('/superadmin');
    safeRevalidate('/superadmin/stores');
    return { success: true };
  } catch (err: any) {
    console.error('deleteStoreAction error:', err);
    return { success: false, error: 'ลบร้านค้าไม่สำเร็จ' };
  }
}

/**
 * สร้างร้านอาหารใหม่จากหน้า Superadmin
 */
export async function createStoreFromSuperadminAction(data: {
  name: string;
  phone: string;
  plan: string;
  promptpay_id?: string;
  promptpay_name?: string;
}): Promise<{ success: boolean; shopId?: string; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const slug = `shop-${randomSuffix}`;

    const { data: newShop, error: shopErr } = await admin
      .from('shops')
      .insert({
        name: data.name.trim(),
        slug,
        phone: data.phone.trim(),
        plan: data.plan || 'basic',
        status: 'active',
        is_active: true,
        promptpay_id: data.promptpay_id || data.phone.trim(),
        promptpay_name: data.promptpay_name || data.name.trim(),
        has_printer: false,
        device_mode: 'multi_device',
        kds_pin: '0000',
      })
      .select('id')
      .single();

    if (shopErr) throw shopErr;

    // สร้างหมวดหมู่เมนูเริ่มต้น
    await admin.from('categories').insert({
      shop_id: newShop.id,
      name: 'เมนูแนะนำ',
      sort_order: 1,
      is_active: true,
    });

    safeRevalidate('/superadmin');
    safeRevalidate('/superadmin/stores');
    return { success: true, shopId: newShop.id };
  } catch (err: any) {
    console.error('createStoreFromSuperadminAction error:', err);
    return { success: false, error: 'สร้างร้านค้าใหม่ไม่สำเร็จ' };
  }
}

export interface ShopBasicInfoInput {
  shopId: string;
  name: string;
  phone: string;
  address: string;
  logoUrl: string;
}

/**
 * Superadmin แก้ข้อมูลร้านพื้นฐานแทนเจ้าของร้าน โดยไม่ต้องสวมรอยเข้าร้าน
 *
 * ตั้งใจรับเฉพาะสี่ฟิลด์นี้ ไม่รับ kds_pin เพราะเป็นรหัสเข้าใช้งาน และไม่รับ
 * พร้อมเพย์เพราะเปลี่ยนปลายทางเงิน ต้องไปทางคำขออนุมัติเท่านั้น
 * (`requestPromptpayChangeAction` / `review_promptpay_change`)
 */
export async function updateShopBasicInfoAction(
  input: ShopBasicInfoInput
): Promise<{ success: boolean; shop?: Partial<Shop>; error?: string }> {
  try {
    const { isSuperadmin, user } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const name = input.name.trim();
    if (!name) {
      return { success: false, error: 'ต้องระบุชื่อร้าน' };
    }

    const phone = input.phone.trim();
    if (phone && !/^[0-9]{9,10}$/.test(phone)) {
      return { success: false, error: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก' };
    }

    const logoUrl = input.logoUrl.trim();
    if (logoUrl && !/^https:\/\//i.test(logoUrl)) {
      return { success: false, error: 'ลิงก์โลโก้ต้องขึ้นต้นด้วย https://' };
    }

    const patch = {
      name,
      phone: phone || null,
      address: input.address.trim() || null,
      logo_url: logoUrl || null,
      updated_at: new Date().toISOString(),
    };

    const admin = createAdminClient();

    // บันทึกร่องรอยก่อนแก้ข้อมูลจริง
    //
    // เดิมเขียน shops ก่อนแล้วค่อยพยายาม insert audit แบบ best-effort
    // audit ล้มเมื่อไหร่ข้อมูลก็เปลี่ยนไปแล้วโดยไม่มีใครรู้ ซึ่งขัดกับเจตนาของ
    // การมี audit ตั้งแต่แรก สลับลำดับให้ audit ล้ม = ไม่แก้ข้อมูล
    const { error: auditError } = await admin.from('audit_logs').insert({
      shop_id: input.shopId,
      user_id: user?.id ?? null,
      action: 'superadmin_update_shop_basic_info',
      entity_type: 'shops',
      entity_id: input.shopId,
      details: { fields: Object.keys(patch).filter((k) => k !== 'updated_at') },
    });
    if (auditError) {
      console.error('updateShopBasicInfoAction audit insert failed:', auditError);
      return { success: false, error: 'บันทึกร่องรอยการแก้ไขไม่สำเร็จ จึงไม่แก้ข้อมูลร้าน' };
    }

    const { data: updated, error } = await admin
      .from('shops')
      .update(patch)
      .eq('id', input.shopId)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return { success: false, error: 'ไม่พบร้านค้านี้' };
    }

    safeRevalidate('/superadmin');
    safeRevalidate('/superadmin/stores');
    return { success: true, shop: patch };
  } catch (err: any) {
    console.error('updateShopBasicInfoAction error:', err);
    return { success: false, error: 'บันทึกข้อมูลร้านไม่สำเร็จ' };
  }
}

/**
 * สวมรอยเข้าร้าน (Impersonate) เพื่อเข้าไปดูหน้า KDS / Walk-in / Settings ของร้านลูกค้านั้น
 */
export async function impersonateStoreAction(shopId: string): Promise<{ success: boolean }> {
  // ทุกหน้าที่อ่าน cookie นี้เรียก checkIsSuperadmin() ซ้ำอยู่แล้ว คนอื่นตั้ง cookie
  // ไปก็ไม่ได้อะไร แต่ action นี้เป็น endpoint สาธารณะ ไม่ควรปล่อยให้ตั้งได้ตั้งแต่แรก
  const { isSuperadmin } = await checkIsSuperadmin();
  if (!isSuperadmin) {
    return { success: false };
  }

  const cookieStore = await cookies();
  cookieStore.set('impersonated_shop_id', shopId, {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 4, // 4 hours
  });
  return { success: true };
}

/**
 * ออกจากการสวมรอยหน้าร้าน กลับมาเป็น Superadmin ปกติ
 */
export async function stopImpersonatingAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete('impersonated_shop_id');
  return { success: true };
}

export interface PromptpayChangeRequestItem {
  id: string;
  shop_id: string;
  shop_name: string | null;
  current_promptpay_id: string | null;
  current_promptpay_name: string | null;
  requested_promptpay_id: string;
  requested_promptpay_name: string;
  reason: string | null;
  status: string;
  requested_at: string;
  requested_by: string | null;
}

/**
 * อ่านคิวคำขอเปลี่ยนพร้อมเพย์ที่ค้างอนุมัติ
 *
 * ตาราง promptpay_change_requests เปิด RLS ไว้เฉพาะคนของร้านนั้น การอ่านคิวรวม
 * จึงต้องผ่าน admin client (bypass RLS) และตรวจ checkIsSuperadmin() ก่อนเสมอ
 *
 * เลขพร้อมเพย์อาจเป็นเลขบัตรประชาชน (PDPA) ผลลัพธ์ของ action นี้มีเลขเต็ม
 * ใช้ได้เฉพาะในหน้า /superadmin/approvals เท่านั้น ห้ามส่งต่อเข้า Telegram
 * หรือ log ใด ๆ ที่อื่นให้ใช้ maskDigits จาก @/lib/telegram
 */
export async function listPromptpayRequestsAction(): Promise<{
  success: boolean;
  requests?: PromptpayChangeRequestItem[];
  error?: string;
}> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('promptpay_change_requests')
      .select(
        'id, shop_id, current_promptpay_id, current_promptpay_name, requested_promptpay_id, requested_promptpay_name, reason, status, requested_at, requested_by, shops (name)'
      )
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) throw error;

    const requests: PromptpayChangeRequestItem[] = (data || []).map((row: any) => ({
      id: row.id,
      shop_id: row.shop_id,
      shop_name: row.shops?.name ?? null,
      current_promptpay_id: row.current_promptpay_id ?? null,
      current_promptpay_name: row.current_promptpay_name ?? null,
      requested_promptpay_id: row.requested_promptpay_id,
      requested_promptpay_name: row.requested_promptpay_name,
      reason: row.reason ?? null,
      status: row.status,
      requested_at: row.requested_at,
      requested_by: row.requested_by ?? null,
    }));

    return { success: true, requests };
  } catch (err: any) {
    console.error('listPromptpayRequestsAction error:', err);
    return { success: false, error: 'โหลดรายการคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}

/**
 * จำนวนคำขอที่ค้างอนุมัติ สำหรับ badge ในไซด์บาร์
 *
 * แยกจาก listPromptpayRequestsAction เพราะไซด์บาร์แสดงทุกหน้า superadmin
 * การดึงเลขพร้อมเพย์เต็มมาทุกหน้าจะกระจายข้อมูล PDPA เกินจำเป็น
 */
export async function getPendingPromptpayCountAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    const admin = createAdminClient();
    const { count, error } = await admin
      .from('promptpay_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;

    return { success: true, count: count ?? 0 };
  } catch (err: any) {
    console.error('getPendingPromptpayCountAction error:', err);
    return { success: false, error: 'โหลดจำนวนคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}

/**
 * อนุมัติหรือปฏิเสธคำขอเปลี่ยนพร้อมเพย์
 *
 * เรียก RPC review_promptpay_change ผ่าน session-bound client เพื่อให้
 * auth.uid() พร้อมสำหรับ is_superadmin() ในฐานข้อมูล การเขียนลง shops และ
 * audit_logs เกิดใน RPC ที่เดียวเท่านั้น ที่นี่ไม่แตะตารางโดยตรง
 */
export async function reviewPromptpayRequestAction(
  requestId: string,
  approve: boolean,
  note?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperadmin } = await checkIsSuperadmin();
    if (!isSuperadmin) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }

    if (!requestId || typeof requestId !== 'string' || requestId.trim().length === 0) {
      return { success: false, error: 'ไม่พบคำขอที่ระบุ' };
    }

    const cleanNote = (note ?? '').trim();
    if (cleanNote.length > 500) {
      return { success: false, error: 'หมายเหตุยาวเกินไป (ไม่เกิน 500 ตัวอักษร)' };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc('review_promptpay_change', {
      p_request_id: requestId.trim(),
      p_approve: approve,
      p_note: cleanNote.length > 0 ? cleanNote : null,
    });

    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('REQUEST_NOT_FOUND')) {
        return { success: false, error: 'ไม่พบคำขอนี้ อาจถูกลบไปแล้ว' };
      }
      if (msg.includes('REQUEST_ALREADY_REVIEWED')) {
        return { success: false, error: 'คำขอนี้ถูกดำเนินการไปแล้ว' };
      }
      if (msg.includes('SHOP_ACCESS_DENIED')) {
        return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการรายการนี้' };
      }
      throw error;
    }

    safeRevalidate('/superadmin/approvals');
    return { success: true };
  } catch (err: any) {
    // ข้อความจากฐานข้อมูลห้ามหลุดถึง client ปลายทางได้แค่ข้อความคงที่
    // กรณีที่ผู้ใช้ต้องรู้สาเหตุจริงถูกแปลไว้แล้วข้างบนก่อนถึงจุดนี้
    console.error('reviewPromptpayRequestAction error:', err);
    return { success: false, error: 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}
