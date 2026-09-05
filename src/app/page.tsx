import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shop } from '@/lib/types';
import { Utensils, Store, ArrowRight, ShieldCheck, UserPlus, ChefHat, Sparkles } from 'lucide-react';

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
      .order('created_at', { ascending: false });

    activeShops = (shops as Shop[]) || [];
  } catch (error) {
    console.error('Failed to load dynamic data for HomePage:', error);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-amber-50/60 via-stone-50 to-amber-100/30">
      <div className="max-w-lg w-full space-y-6 bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-100/80">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/30">
            <Utensils className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              รับอาหาร (Rab-R-HAN)
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
              สั่งอาหารออนไลน์ล่วงหน้า รับสะดวกที่หน้าร้าน พร้อมระบบตรวจสอบสลิปอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Logged in User's Shop Card */}
        {user && userShop && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>ร้านค้าของคุณ ({user.email})</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                เปิดบริการ
              </span>
            </div>

            <div className="font-bold text-stone-900 text-base">
              {userShop.name}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Link
                href="/admin/orders"
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <ChefHat className="w-4 h-4" />
                <span>จัดการหลังร้าน (KDS)</span>
              </Link>
              <Link
                href={`/${userShop.slug}`}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-stone-50 border border-amber-300 text-amber-800 text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <Store className="w-4 h-4 text-amber-600" />
                <span>เปิดเมนูสั่งอาหาร</span>
              </Link>
            </div>
          </div>
        )}

        {/* Active Shops Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-stone-700 px-1">
            <span>เลือกร้านอาหารเพื่อสั่งซื้อ</span>
            <span className="text-stone-400 font-normal">({activeShops.length} ร้าน)</span>
          </div>

          {activeShops.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl bg-stone-50 border border-dashed border-stone-200 text-stone-400 text-xs">
              ยังไม่มีร้านอาหารที่เปิดให้บริการในขณะนี้
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeShops.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/${shop.slug}`}
                  className="flex items-center justify-between w-full px-4 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-2xl shadow-md shadow-amber-600/20 transition-all group"
                >
                  <div className="flex items-center gap-3 text-left min-w-0">
                    {shop.logo ? (
                      <img
                        src={shop.logo}
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
                      <div className="text-xs text-amber-100 flex items-center gap-1">
                        <span>สั่งอาหารและรับที่ร้าน</span>
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
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-3 px-3 bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-bold text-xs rounded-2xl transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-stone-500" />
              <span>เข้าสู่ระบบหลังร้าน</span>
            </Link>

            <Link
              href="/register"
              className="flex items-center justify-center gap-2 w-full py-3 px-3 bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-bold text-xs rounded-2xl transition-all"
            >
              <UserPlus className="w-4 h-4 text-stone-500" />
              <span>ลงทะเบียนเปิดร้านใหม่</span>
            </Link>
          </div>
        </div>

        <div className="pt-2 text-center text-[11px] text-stone-400">
          Rab-R-HAN Platform MVP • Multi-device & Zero-printer Ready
        </div>
      </div>
    </main>
  );
}
