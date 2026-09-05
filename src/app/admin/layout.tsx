import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { stopImpersonatingAction } from '@/app/actions/superadmin';
import { Shop } from '@/lib/types';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  let currentShop: Shop | null = null;
  let isImpersonated = false;

  const cookieStore = await cookies();
  const impersonatedShopId = cookieStore.get('impersonated_shop_id')?.value;

  if (impersonatedShopId) {
    const { data: impShop } = await admin
      .from('shops')
      .select('*')
      .eq('id', impersonatedShopId)
      .maybeSingle();

    if (impShop) {
      currentShop = impShop as Shop;
      isImpersonated = true;
    }
  }

  if (!currentShop && user) {
    // 1. ดึงข้อมูลสมาชิกเพื่อหา shop_id
    const { data: userProfile } = await admin
      .from('users')
      .select('shop_id, role')
      .eq('id', user.id)
      .single();

    if (userProfile?.shop_id) {
      const { data: shop } = await admin
        .from('shops')
        .select('*')
        .eq('id', userProfile.shop_id)
        .single();
      currentShop = shop as Shop;
    }
  }

  // หากยังไม่ได้ login ให้ fallback ไปยังร้านตัวอย่างแรกสำหรับ dev testing หรือ redirect
  if (!currentShop) {
    const { data: defaultShop } = await admin
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (defaultShop) {
      currentShop = defaultShop as Shop;
    } else {
      redirect('/login');
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {isImpersonated && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">⚠️</span>
            <span>โหมด SUPERADMIN: กำลังเข้าจัดการร้าน "{currentShop.name}"</span>
          </div>
          <form
            action={async () => {
              'use server';
              await stopImpersonatingAction();
              redirect('/superadmin/stores');
            }}
          >
            <button
              type="submit"
              className="px-3 py-1 bg-white text-amber-900 rounded-lg text-[11px] font-bold hover:bg-amber-50 cursor-pointer"
            >
              กลับสู่ Superadmin ✕
            </button>
          </form>
        </div>
      )}
      <AdminNavbar shopId={currentShop.id} shopName={currentShop.name} />
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
