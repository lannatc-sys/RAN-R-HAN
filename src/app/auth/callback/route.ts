import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const oauthError =
    requestUrl.searchParams.get('error_description') ||
    requestUrl.searchParams.get('error');

  // ตรวจสอบ domain ที่แท้จริง (รองรับ reverse proxy และ custom domain)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const origin =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? requestUrl.origin
      : `${forwardedProto}://${forwardedHost}`;

  if (oauthError) {
    console.error('OAuth Callback Error from provider:', oauthError);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session?.user) {
      const user = data.session.user;
      const admin = createAdminClient();

      // ตรวจสอบสิทธิ์ผู้ดูแลระบบสูงสุด (Superadmin) จาก Environment Variable
      const superAdminEnv = process.env.SUPER_ADMIN_USER || process.env.SUPER_ADMIN;
      const userEmail = user.email?.toLowerCase().trim() || '';
      const isSuperAdmin = Boolean(
        superAdminEnv &&
          superAdminEnv
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .includes(userEmail)
      );

      // ตรวจสอบว่าผู้ใช้มีโปรไฟล์ในตาราง public.users แล้วหรือไม่
      const { data: existingUser } = await admin
        .from('users')
        .select('id, shop_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        // หากผู้ใช้อยู่ในรายชื่อ SUPER_ADMIN_USER แต่ role ใน DB ยังไม่เป็น superadmin ให้อัปเดตทันที
        if (isSuperAdmin && existingUser.role !== 'superadmin') {
          await admin
            .from('users')
            .update({
              role: 'superadmin',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }

        if (next) {
          return NextResponse.redirect(`${origin}${next}`);
        }

        // หากเป็น Superadmin ให้พาไปยังหน้าศูนย์กลาง /superadmin
        if (isSuperAdmin) {
          return NextResponse.redirect(`${origin}/superadmin`);
        }

        return NextResponse.redirect(`${origin}/admin/orders`);
      }

      // กรณีล็อกอิน Google เป็นครั้งแรก (First-time user): ดึงข้อมูลจาก metadata
      const meta = user.user_metadata || {};
      const fullName =
        meta.full_name ||
        meta.name ||
        `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
        userEmail.split('@')[0] ||
        'เจ้าของร้าน';
      const phone = meta.phone || null;
      const shopName = meta.shop_name || `ร้านของ ${fullName}`;

      // สร้างร้านค้าใหม่เริ่มต้น
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const shopSlug = `shop-${randomSuffix}`;

      const { data: newShop, error: shopError } = await admin
        .from('shops')
        .insert({
          name: shopName,
          slug: shopSlug,
          phone: phone,
          promptpay_id: phone,
          promptpay_name: fullName,
          is_active: true,
          status: 'active',
          has_printer: false,
          device_mode: 'multi_device',
          kds_pin: '0000',
        })
        .select()
        .single();

      if (shopError) {
        console.error('Error creating shop for Google user:', shopError);
      } else if (newShop) {
        const userRole = isSuperAdmin ? 'superadmin' : 'owner';

        await admin.from('users').upsert({
          id: user.id,
          shop_id: newShop.id,
          role: userRole,
          full_name: fullName,
          phone: phone,
          updated_at: new Date().toISOString(),
        });

        await admin.from('categories').insert({
          shop_id: newShop.id,
          name: 'เมนูแนะนำ',
          sort_order: 1,
          is_active: true,
        });
      }

      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      if (isSuperAdmin) {
        return NextResponse.redirect(`${origin}/superadmin`);
      }

      return NextResponse.redirect(`${origin}/admin/orders`);
    }

    if (error) {
      console.error('exchangeCodeForSession error:', error);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // หากเกิดข้อผิดพลาดหรือไม่ได้รับ code
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
