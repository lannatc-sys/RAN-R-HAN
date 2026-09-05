import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shop_name, first_name, last_name, phone, email, password } = body;

    if (!shop_name || !first_name || !last_name || !phone || !email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    const fullName = `${first_name.trim()} ${last_name.trim()}`;
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องมี 9-10 หลัก' },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin;
    const supabase = await createClient();

    // 1. สมัครสมาชิกผ่าน Supabase Auth
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
        return NextResponse.json(
          { error: 'อีเมลนี้มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const user = authData.user;
    if (!user) {
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างผู้ใช้ได้' },
        { status: 500 }
      );
    }

    const admin = createAdminClient();

    // 2. สร้างร้านค้าใหม่
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const shopSlug = `shop-${randomSuffix}`;

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
      // 3. บันทึกโปรไฟล์ลงใน public.users
      const { error: userError } = await admin.from('users').upsert({
        id: user.id,
        shop_id: newShop.id,
        role: 'owner',
        full_name: fullName,
        phone: cleanPhone,
      });

      if (userError) {
        console.error('Error creating user profile:', userError);
      }

      // 4. สร้างหมวดหมู่อาหารเริ่มต้น
      await admin.from('categories').insert({
        shop_id: newShop.id,
        name: 'เมนูทั่วไป',
        sort_order: 1,
        is_active: true,
      });
    }

    // ตรวจสอบว่าต้องยืนยันตัวตนทางอีเมลหรือไม่
    const requiresEmailConfirmation = !authData.session;

    return NextResponse.json({
      success: true,
      requiresEmailConfirmation,
      email: email.trim().toLowerCase(),
    });
  } catch (error: any) {
    console.error('Register API route error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' },
      { status: 500 }
    );
  }
}
