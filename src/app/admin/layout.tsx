import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { Shop } from '@/lib/types';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentShop: Shop | null = null;
  const admin = createAdminClient();

  if (user) {
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
      <AdminNavbar shopId={currentShop.id} shopName={currentShop.name} />
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
