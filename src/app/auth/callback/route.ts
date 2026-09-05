import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session?.user) {
      const user = data.session.user;
      const admin = createAdminClient();

      // ตรวจสอบว่าผู้ใช้มีร้านหรือโปรไฟล์ใน public.users แล้วหรือไม่
      const { data: existingUser } = await admin
        .from('users')
        .select('id, shop_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingUser || !existingUser.shop_id) {
        const meta = user.user_metadata || {};
        const fullName =
          meta.full_name ||
          meta.name ||
          `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
          user.email?.split('@')[0] ||
          'เจ้าของร้าน';
        const phone = meta.phone || null;
        const shopName = meta.shop_name || `ร้านของ ${fullName}`;

        // สร้างร้านค้าใหม่
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const shopSlug = `shop-${randomSuffix}`;

        const { data: newShop } = await admin
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
          })
          .select()
          .single();

        if (newShop) {
          await admin.from('users').upsert({
            id: user.id,
            shop_id: newShop.id,
            role: 'owner',
            full_name: fullName,
            phone: phone,
          });

          await admin.from('categories').insert({
            shop_id: newShop.id,
            name: 'เมนูทั่วไป',
            sort_order: 1,
            is_active: true,
          });
        }
      }

      return NextResponse.redirect(`${origin}/admin/orders`);
    }
  }

  // หากเกิดข้อผิดพลาด ให้กลับไปหน้าเข้าสู่ระบบ
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
