import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shop } from '@/lib/types';
import { Utensils, Store, ArrowRight, ShieldCheck, UserPlus, ChefHat, Sparkles } from 'lucide-react';
import { HeaderControls } from '@/components/common/HeaderControls';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let user = null;
  let userShop: Shop | null = null;
  let activeShops: Shop[] = [];

  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    user = authData?.user || null;

    const admin = createAdminClient();

    if (user) {
      const { data: userProfile } = await admin
        .from('users')
        .select('shop_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (userProfile?.shop_id) {
        const { data: shop } = await admin
          .from('shops')
          .select('*')
          .eq('id', userProfile.shop_id)
          .maybeSingle();
        userShop = (shop as Shop) || null;
      }
    }

    // ดึงร้านค้าทั้งหมดที่ active อยู่ในระบบ
    const { data: shops } = await admin
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'active')
      .eq('is_open', true)
      .order('created_at', { ascending: false });

    activeShops = (shops as Shop[]) || [];
  } catch (error) {
    console.error('Failed to load dynamic data for HomePage:', error);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-3.5 sm:p-6 bg-gradient-to-b from-amber-50/60 via-stone-50 to-amber-100/30 dark:from-stone-950 dark:via-[#0c0a09] dark:to-stone-900 transition-colors">
      {/* Top Floating Controls */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20">
        <HeaderControls />
      </div>

      <div className="max-w-lg w-full space-y-5 sm:space-y-6 bg-white dark:bg-stone-900 p-5 sm:p-8 rounded-3xl shadow-xl shadow-amber-900/5 dark:shadow-black/40 border border-amber-100/80 dark:border-stone-800 transition-colors">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/30">
            <Utensils className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              RAN-R-HAN
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              สั่งอาหารออนไลน์ ทานที่ร้าน รับหน้าร้าน หรือให้ร้านจัดส่ง พร้อมระบบสลิปอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Logged in User's Shop Card */}
        {user && userShop && (
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>ร้านค้าของคุณ ({user.email})</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                userShop.is_open !== false
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
              }`}>
                {userShop.is_open !== false ? 'เปิดรับออเดอร์' : 'ปิดรับออเดอร์'}
              </span>
            </div>

            <div className="font-bold text-stone-900 dark:text-stone-100 text-base">
              {userShop.name}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Link
                href="/admin/orders"
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all min-h-[40px]"
              >
                <ChefHat className="w-4 h-4" />
                <span>จัดการหลังร้าน (KDS)</span>
              </Link>
              <Link
                href={userShop.is_open !== false ? `/${userShop.slug}` : '/admin/settings'}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-xl shadow-xs transition-all min-h-[40px]"
              >
                <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{userShop.is_open !== false ? 'เปิดเมนูสั่งอาหาร' : 'ตั้งค่าเปิดร้าน'}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Active Shops Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 px-1">
            <span>เลือกร้านอาหารเพื่อสั่งซื้อ</span>
            <span className="text-stone-400 dark:text-stone-500 font-normal">({activeShops.length} ร้าน)</span>
          </div>

          {activeShops.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-dashed border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-500 text-xs">
              ยังไม่มีร้านอาหารที่เปิดให้บริการในขณะนี้
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeShops.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/${shop.slug}`}
                  className="flex items-center justify-between w-full px-4 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-2xl shadow-md shadow-amber-600/20 transition-all group min-h-[48px]"
                >
                  <div className="flex items-center gap-3 text-left min-w-0">
                    {shop.logo_url || shop.logo ? (
                      <img
                        src={shop.logo_url || shop.logo || ''}
                        alt={shop.name}
                        className="w-9 h-9 rounded-xl object-cover bg-white/20 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-amber-700/50 flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-sm font-bold truncate">{shop.name}</div>
                      <div className="text-xs text-amber-100 flex items-center gap-1 truncate">
                        <span>สั่งออนไลน์ • ทานที่ร้าน • ส่งถึงที่</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions for Store Owners / Staff */}
        <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-3 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/80 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-2xl transition-all min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4 text-stone-500 dark:text-stone-400" />
              <span>เข้าสู่ระบบหลังร้าน</span>
            </Link>

            <Link
              href="/register"
              className="flex items-center justify-center gap-2 w-full py-3 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/80 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-2xl transition-all min-h-[44px]"
            >
              <UserPlus className="w-4 h-4 text-stone-500 dark:text-stone-400" />
              <span>ลงทะเบียนเปิดร้านใหม่</span>
            </Link>
          </div>
        </div>

        <div className="pt-2 text-center text-[11px] text-stone-400 dark:text-stone-500">
          RAN-R-HAN Platform • Bilingual & Responsive Multi-device
        </div>
      </div>
    </main>
  );
}
