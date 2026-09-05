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

    // หากยังไม่มี superadmin ใดๆ ในระบบเลย ให้บัญชีแรกที่เข้ามาสามารถเป็น superadmin ได้
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
    const admin = createAdminClient();

    // 1. สถิติจำนวนร้านค้า
    const { data: shops, error: shopsErr } = await admin
      .from('shops')
      .select('id, status, is_active');

    if (shopsErr) throw shopsErr;

    const totalStores = shops?.length || 0;
    const activeStores = shops?.filter((s) => s.status === 'active').length || 0;
    const suspendedStores = shops?.filter((s) => s.status === 'suspended').length || 0;

    // 2. สถิติออเดอร์และยอดขาย (GMV)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('id, total, status, created_at')
      .neq('status', 'cancelled');

    if (ordersErr) throw ordersErr;

    const totalOrders = orders?.length || 0;
    const totalRevenue = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);

    const todayOrdersList = (orders || []).filter(
      (o) => new Date(o.created_at) >= todayStart
    );
    const todayOrders = todayOrdersList.length;
    const todayRevenue = todayOrdersList.reduce((sum, o) => sum + Number(o.total || 0), 0);

    return {
      success: true,
      stats: {
        totalStores,
        activeStores,
        suspendedStores,
        totalOrders,
        todayOrders,
        totalRevenue,
        todayRevenue,
      },
    };
  } catch (err: any) {
    console.error('getPlatformStatsAction error:', err);
    return { success: false, error: err.message || 'Failed to fetch platform stats' };
  }
}

/**
 * ดึงรายชื่อร้านค้าทั้งหมด พร้อมตัวกรองค้นหาและสถานะ
 */
export async function getAllStoresAction(query?: string, statusFilter?: string): Promise<{
  success: boolean;
  stores?: (Shop & { order_count?: number; revenue?: number })[];
  error?: string;
}> {
  try {
    const admin = createAdminClient();

    let dbQuery = admin.from('shops').select(`
      *,
      orders (id, total, status)
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
      const revenue = validOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      const { orders: _, ...shopFields } = shop;
      return {
        ...shopFields,
        order_count: validOrders.length,
        revenue,
      };
    });

    return { success: true, stores };
  } catch (err: any) {
    console.error('getAllStoresAction error:', err);
    return { success: false, error: err.message || 'Failed to fetch stores' };
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
    return { success: false, error: err.message || 'Failed to update store status' };
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
    return { success: false, error: err.message || 'Failed to update store plan' };
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
    return { success: false, error: err.message || 'Failed to create new store' };
  }
}

/**
 * สวมรอยเข้าร้าน (Impersonate) เพื่อเข้าไปดูหน้า KDS / Walk-in / Settings ของร้านลูกค้านั้น
 */
export async function impersonateStoreAction(shopId: string): Promise<{ success: boolean }> {
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
