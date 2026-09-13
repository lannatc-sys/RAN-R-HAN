'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, Shield, X } from 'lucide-react';
import { HeaderControls } from '@/components/common/HeaderControls';
import { PushNotificationPrompt } from './PushNotificationPrompt';

export interface AdminNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AdminMobileNavigationProps {
  shopId: string;
  shopName: string;
  navItems: AdminNavigationItem[];
  lang: 'th' | 'en';
  superadminLabel: string;
  logoutLabel: string;
  onLogout: () => Promise<void>;
}

export function AdminMobileNavigation({
  shopId,
  shopName,
  navItems,
  lang,
  superadminLabel,
  logoutLabel,
  onLogout,
}: AdminMobileNavigationProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const openMenuLabel = lang === 'th' ? 'เปิดเมนูจัดการร้าน' : 'Open admin menu';
  const closeMenuLabel = lang === 'th' ? 'ปิดเมนูจัดการร้าน' : 'Close admin menu';
  const navigationLabel = lang === 'th' ? 'เมนูจัดการร้าน' : 'Admin navigation';

  const openMobileNavigation = () => {
    if (!drawerRef.current?.open) {
      drawerRef.current?.showModal();
      setIsMobileNavOpen(true);
    }
  };

  const closeMobileNavigation = () => {
    if (drawerRef.current?.open) {
      drawerRef.current.close();
    }
    setIsMobileNavOpen(false);
  };

  useEffect(() => {
    drawerRef.current?.close();
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        drawerRef.current?.close();
        setIsMobileNavOpen(false);
      }
    };

    desktopQuery.addEventListener('change', closeAtDesktop);
    return () => desktopQuery.removeEventListener('change', closeAtDesktop);
  }, []);

  const handleMobileLogout = async () => {
    closeMobileNavigation();
    await onLogout();
  };

  return (
    <>
      <button
        type="button"
        onClick={openMobileNavigation}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-stone-200 text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 lg:hidden"
        aria-label={openMenuLabel}
        aria-controls="admin-mobile-navigation"
        aria-expanded={isMobileNavOpen}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <dialog
        ref={drawerRef}
        id="admin-mobile-navigation"
        aria-label={navigationLabel}
        onClose={closeMobileNavigation}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeMobileNavigation();
          }
        }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-svh max-h-none w-[min(20rem,85vw)] max-w-none overflow-hidden border-0 bg-transparent p-0 text-stone-900 backdrop:bg-black/50 dark:text-stone-100 lg:hidden"
      >
        <div className="flex h-full flex-col bg-white shadow-2xl dark:bg-stone-900">
          <div className="flex items-center justify-between border-b border-stone-200 p-4 dark:border-stone-800">
            <div className="min-w-0">
              <h2 className="text-sm font-bold">{navigationLabel}</h2>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">{shopName}</p>
            </div>
            <button
              type="button"
              onClick={closeMobileNavigation}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:text-stone-400 dark:hover:bg-stone-800"
              aria-label={closeMenuLabel}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <nav aria-label={navigationLabel} className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white'
                  }`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-stone-200 p-4 dark:border-stone-800">
            <PushNotificationPrompt shopId={shopId} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                {lang === 'th' ? 'ภาษาและการแสดงผล' : 'Language and appearance'}
              </span>
              <HeaderControls />
            </div>
            <Link
              href="/superadmin"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
            >
              <Shield aria-hidden="true" className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span>{superadminLabel}</span>
            </Link>
            <button
              type="button"
              onClick={handleMobileLogout}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
              <span>{logoutLabel}</span>
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
