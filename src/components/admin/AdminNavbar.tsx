'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChefHat,
  LogOut,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HeaderControls } from '@/components/common/HeaderControls';
import { AdminMobileNavigation } from './AdminMobileNavigation';
import { PushNotificationPrompt } from './PushNotificationPrompt';

interface AdminNavbarProps {
  shopId: string;
  shopName: string;
}

export function AdminNavbar({ shopId, shopName }: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const navItems = [
    { href: '/admin/orders', label: t.nav.queue, icon: ChefHat },
    { href: '/admin/walk-in', label: t.nav.walkIn, icon: ShoppingBag },
    { href: '/admin/delivery', label: lang === 'th' ? 'จัดส่ง/รอบส่ง' : 'Delivery', icon: Truck },
    { href: '/admin/menu', label: t.nav.menu, icon: UtensilsCrossed },
    { href: '/admin/settings', label: t.nav.settings, icon: Settings },
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white text-stone-900 transition-colors dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-600 font-bold text-white shadow-xs sm:h-9 sm:w-9">
            <Store aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold leading-tight sm:text-sm">
              {shopName}
            </div>
            <div className="truncate text-[10px] text-stone-400 dark:text-stone-500 sm:text-[11px]">
              {lang === 'th' ? 'ระบบจัดการหลังร้าน (POS/KDS)' : 'Store Management (POS/KDS)'}
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 lg:flex">
          <PushNotificationPrompt shopId={shopId} />
          <HeaderControls />
          <Link
            href="/superadmin"
            className="flex items-center gap-1.5 rounded-xl p-2 text-xs text-stone-500 transition-colors hover:bg-amber-50/80 hover:text-amber-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-amber-400"
            title="ศูนย์ควบคุม Superadmin"
          >
            <Shield aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold">{t.nav.superadmin}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl p-2 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span>{t.nav.logout}</span>
          </button>
        </div>

        <AdminMobileNavigation
          shopId={shopId}
          shopName={shopName}
          navItems={navItems}
          lang={lang}
          superadminLabel={t.nav.superadmin}
          logoutLabel={t.nav.logout}
          onLogout={handleLogout}
        />
      </div>

      <nav
        aria-label={lang === 'th' ? 'เมนูจัดการร้าน' : 'Admin navigation'}
        className="hidden max-w-6xl items-center gap-1 border-t border-stone-100 px-4 dark:border-stone-800 lg:mx-auto lg:flex"
      >
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'border-amber-600 text-amber-800 dark:text-amber-400'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
