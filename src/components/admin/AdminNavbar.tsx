'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { ChefHat, ShoppingBag, UtensilsCrossed, Settings, LogOut, Store, Shield, Truck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HeaderControls } from '@/components/common/HeaderControls';

interface AdminNavbarProps {
  shopId: string;
  shopName: string;
}

export function AdminNavbar({ shopId, shopName }: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/admin/orders', label: t.nav.queue, icon: ChefHat },
    { href: '/admin/walk-in', label: t.nav.walkIn, icon: ShoppingBag },
    { href: '/admin/delivery', label: lang === 'th' ? 'จัดส่ง/รอบส่ง' : 'Delivery', icon: Truck },
    { href: '/admin/menu', label: t.nav.menu, icon: UtensilsCrossed },
    { href: '/admin/settings', label: t.nav.settings, icon: Settings },
  ];

  return (
    <header className="bg-white dark:bg-stone-900 border-b border-stone-200/80 dark:border-stone-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Shop Name */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 leading-tight truncate">
              {shopName}
            </div>
            <div className="text-[10px] sm:text-[11px] text-stone-400 dark:text-stone-500 truncate">
              {lang === 'th' ? 'ระบบจัดการหลังร้าน (POS/KDS)' : 'Store Management (POS/KDS)'}
            </div>
          </div>
        </div>

        {/* Push Notification Toggle (Desktop) */}
        <div className="hidden lg:flex items-center">
          <PushNotificationPrompt shopId={shopId} />
        </div>

        {/* Actions & Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderControls />

          <Link
            href="/superadmin"
            className="text-stone-500 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-400 text-xs flex items-center gap-1.5 p-2 rounded-xl hover:bg-amber-50/80 dark:hover:bg-stone-800 transition-colors"
            title="ศูนย์ควบคุม Superadmin"
          >
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline font-semibold">{t.nav.superadmin}</span>
          </Link>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-xs flex items-center gap-1.5 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label={t.nav.logout}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t.nav.logout}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 overflow-x-auto flex gap-1 border-t border-stone-100 dark:border-stone-800 no-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-amber-600 text-amber-800 dark:text-amber-400'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
