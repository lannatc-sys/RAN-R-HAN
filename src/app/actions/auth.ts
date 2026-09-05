'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RegisterInput } from '@/lib/types';

export async function registerUserAction(input: RegisterInput) {
  try {
    const { shop_name, first_name, last_name, phone, email, password, origin } = input;

    if (!shop_name || !first_name || !last_name || !phone || !email || !password) {
      return { success: false, error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' };
    }

    if (password.length < 6) {
      return { success: false, error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' };
    }

    const fullName = `${first_name.trim()} ${last_name.trim()}`;
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      return { success: false, error: 'เบอร์โทรศัพท์ต้องมี 9-10 หลัก' };
    }

    const supabase = await createClient();

    // 1. สมัครสมาชิกผ่าน Supabase Auth พร้อมแนบ user_metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          shop_name: shop_name.trim(),
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          full_name: fullName,
          phone: cleanPhone,
        },
      },
    });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        return { success: false, error: 'อีเมลนี้มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ' };
      }
      return { success: false, error: authError.message };
    }

    const user = authData.user;
    if (!user) {
      return { success: false, error: 'ไม่สามารถสร้างผู้ใช้ได้' };
    }

    const admin = createAdminClient();

    // สร้าง slug ไม่ให้ซ้ำสำหรับร้านใหม่
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const shopSlug = `shop-${randomSuffix}`;

    // สร้างร้านค้าใหม่
    const { data: newShop, error: shopError } = await admin
      .from('shops')
      .insert({
        name: shop_name.trim(),
        slug: shopSlug,
        phone: cleanPhone,
        promptpay_id: cleanPhone,
        promptpay_name: fullName,
        is_active: true,
        status: 'active',
        has_printer: false,
        device_mode: 'multi_device',
      })
      .select()
      .single();

    if (shopError) {
      console.error('Error creating shop:', shopError);
    } else if (newShop) {
      // ตรวจสอบว่าตรงกับ SUPER_ADMIN_USER ใน env หรือไม่
      const superAdminEnv = process.env.SUPER_ADMIN_USER || process.env.SUPER_ADMIN;
      const isSuperAdmin = superAdminEnv
        ?.split(',')
        .map((e) => e.trim().toLowerCase())
        .includes(email.trim().toLowerCase());

      const userRole = isSuperAdmin ? 'superadmin' : 'owner';

      // บันทึกโปรไฟล์ลงใน public.users
      const { error: userError } = await admin.from('users').upsert({
        id: user.id,
        shop_id: newShop.id,
        role: userRole,
        full_name: fullName,
        phone: cleanPhone,
      });

      if (userError) {
        console.error('Error creating user profile:', userError);
      }

      // สร้างหมวดหมู่อาหารเริ่มต้น
      await admin.from('categories').insert({
        shop_id: newShop.id,
        name: 'เมนูทั่วไป',
        sort_order: 1,
        is_active: true,
      });
    }

    // ตรวจสอบว่าต้องยืนยันตัวตนทางอีเมลหรือไม่
    // หาก authData.session เป็น null แสดงว่าระบบเปิด Email Confirmation ไว้
    const requiresEmailConfirmation = !authData.session;

    return {
      success: true,
      requiresEmailConfirmation,
      email: email.trim().toLowerCase(),
    };
  } catch (error: any) {
    console.error('registerUserAction error:', error);
    return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' };
  }
}
