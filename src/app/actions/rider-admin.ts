'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // ignore
  }
}

export interface CreateRiderInput {
  shop_id: string;
  display_name: string;
  phone: string;
  vehicle_type?: string;
  email: string;
  password?: string;
  telegram_chat_id?: string;
}

/**
 * สร้างบัญชีไรเดอร์ใหม่ พร้อมผูกบัญชี Supabase Auth สำหรับล็อกอิน
 */
export async function createRiderAction(input: CreateRiderInput): Promise<{
  success: boolean;
  rider_id?: string;
  auth_user_id?: string;
  error?: string;
}> {
  try {
    const { shop_id, display_name, phone, vehicle_type = 'motorcycle', email, password, telegram_chat_id } = input;

    if (!shop_id) {
      return { success: false, error: 'ไม่พบรหัสร้านค้า (shop_id)' };
    }

    if (!display_name || display_name.trim().length === 0) {
      return { success: false, error: 'กรุณาระบุชื่อไรเดอร์' };
    }

    if (!phone || phone.trim().length < 9) {
      return { success: false, error: 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง' };
    }

    if (!email || !email.includes('@')) {
      return { success: false, error: 'กรุณาระบุอีเมลที่ถูกต้องสำหรับเข้าสู่ระบบ' };
    }

    const cleanPassword = password && password.trim().length >= 6 ? password.trim() : 'rider1234';

    const supabase = await createClient();
    const {
      data: { user: currentUser },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !currentUser) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    // ตรวจสอบสิทธิ์ร้านค้า
    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: shop_id,
    });

    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการไรเดอร์ของร้านนี้' };
    }

    const admin = createAdminClient();

    // 1. สร้าง Supabase Auth User (admin API bypasses email confirmation requirement for instant pilot testing)
    let authUserId: string | null = null;

    const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        role: 'rider',
        shop_id,
        display_name: display_name.trim(),
      },
    });

    if (createUserError) {
      // หาก User มีอยู่แล้วใน Auth ให้ลองค้นหา user_id
      if (createUserError.message?.toLowerCase().includes('already') || createUserError.message?.includes('registered')) {
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        const found = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (found) {
          authUserId = found.id;
        } else {
          return { success: false, error: `อีเมลนี้มีอยู่ในระบบแล้ว: ${createUserError.message}` };
        }
      } else {
        return { success: false, error: `ไม่สามารถสร้างบัญชีผู้ใช้ได้: ${createUserError.message}` };
      }
    } else if (authUser?.user) {
      authUserId = authUser.user.id;
    }

    if (!authUserId) {
      return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Auth ID' };
    }

    // 2. บันทึกข้อมูลลงตาราง riders
    const { data: newRider, error: insertError } = await admin
      .from('riders')
      .insert({
        shop_id,
        auth_user_id: authUserId,
        display_name: display_name.trim(),
        phone: phone.trim(),
        vehicle_type,
        status: 'active',
        telegram_chat_id: telegram_chat_id?.trim() || null,
        performance_score: 5.0,
      })
      .select('id')
      .single();

    if (insertError) {
      return { success: false, error: `ไม่สามารถบันทึกข้อมูลไรเดอร์: ${insertError.message}` };
    }

    safeRevalidate('/admin/riders');
    return {
      success: true,
      rider_id: newRider.id,
      auth_user_id: authUserId,
    };
  } catch (err: any) {
    console.error('createRiderAction error:', err);
    return { success: false, error: err.message || 'Internal Server Error' };
  }
}

/**
 * ปรับเปลี่ยนสถานะไรเดอร์ (active, inactive, suspended)
 */
export async function updateRiderStatusAction(
  riderId: string,
  newStatus: 'active' | 'inactive' | 'suspended'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const admin = createAdminClient();

    const { data: rider, error: fetchError } = await admin
      .from('riders')
      .select('shop_id')
      .eq('id', riderId)
      .single();

    if (fetchError || !rider) {
      return { success: false, error: 'ไม่พบข้อมูลไรเดอร์' };
    }

    const { data: hasAccess } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: rider.shop_id,
    });

    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์จัดการไรเดอร์ของร้านนี้' };
    }

    const { error: updateError } = await admin
      .from('riders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', riderId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    safeRevalidate('/admin/riders');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * ผูกหรืออัปเดต Telegram Chat ID ของไรเดอร์
 */
export async function updateRiderTelegramChatIdAction(
  riderId: string,
  telegramChatId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('riders')
      .update({
        telegram_chat_id: telegramChatId?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', riderId);

    if (error) {
      return { success: false, error: error.message };
    }

    safeRevalidate('/admin/riders');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
