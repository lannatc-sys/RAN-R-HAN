'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Truck, CalendarClock } from 'lucide-react';
import clsx from 'clsx';

export function DeliverySubNav() {
  const pathname = usePathname();

  const tabs = [
    {
      href: '/admin/delivery/trips',
      label: 'เที่ยวส่งของ (Trips)',
      icon: Truck,
      active: pathname.startsWith('/admin/delivery/trips'),
    },
    {
      href: '/admin/delivery/preorder',
      label: 'รอบพรีออเดอร์ (Preorder)',
      icon: CalendarClock,
      active: pathname.startsWith('/admin/delivery/preorder'),
    },
    {
      href: '/admin/delivery/locations',
      label: 'จุดรับสินค้า (Master Data)',
      icon: MapPin,
      active: pathname === '/admin/delivery/locations',
    },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2 mb-6 overflow-x-auto">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0',
              tab.active
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            )}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
