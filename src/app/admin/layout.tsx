import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { stopImpersonatingAction, checkIsSuperadmin } from '@/app/actions/superadmin';
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
    const { isSuperadmin } = await checkIsSuperadmin();

    if (isSuperadmin) {
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

  if (!currentShop) {
    redirect('/login');
  }

  const hasSupportConsent = Boolean(
    currentShop.support_access_expires_at &&
    new Date(currentShop.support_access_expires_at) > new Date()
  );
  const remainingHours = hasSupportConsent
    ? Math.max(
        1,
        Math.ceil(
          (new Date(currentShop.support_access_expires_at!).getTime() - Date.now()) /
            (1000 * 60 * 60)
        )
      )
    : 0;

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors duration-200 flex flex-col">
      {isImpersonated && (
        <div
          className={`${
            hasSupportConsent ? 'bg-emerald-700' : 'bg-slate-900'
          } text-white px-4 py-2.5 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm sticky top-0 z-50`}
        >
          <div className="flex items-center gap-2">
            <span>{hasSupportConsent ? '🔓' : '🔒'}</span>
            <span>
              โหมด SUPERADMIN: กำลังเข้าจัดการร้าน "{currentShop.name}" —{' '}
              {hasSupportConsent ? (
                <span className="text-emerald-200">
                  ได้รับสิทธิ์เข้าถึงยอดขาย (หมดอายุในอีก ~{remainingHours} ชม.)
                </span>
              ) : (
                <span className="text-amber-300">
                  โหมดความเป็นส่วนตัว (Privacy Mode): ยอดเงินถูกเซ็นเซอร์เป็น *** ฿ เนื่องจากร้านยังไม่อนุญาต Support Access
                </span>
              )}
            </span>
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
              className="px-3 py-1 bg-white text-slate-900 rounded-lg text-[11px] font-bold hover:bg-slate-100 cursor-pointer shadow-xs"
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
