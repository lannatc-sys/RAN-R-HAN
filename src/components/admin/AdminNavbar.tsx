'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { ChefHat, ShoppingBag, UtensilsCrossed, Settings, LogOut, Store, Shield } from 'lucide-react';

interface AdminNavbarProps {
  shopId: string;
  shopName: string;
}

export function AdminNavbar({ shopId, shopName }: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/admin/orders', label: 'คิวออเดอร์', icon: ChefHat },
    { href: '/admin/walk-in', label: 'สั่งแทนลูกค้า', icon: ShoppingBag },
    { href: '/admin/menu', label: 'จัดการเมนู', icon: UtensilsCrossed },
    { href: '/admin/settings', label: 'ตั้งค่าร้าน & ยอดขาย', icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-stone-200/80 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Brand & Shop Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-900 leading-tight">{shopName}</div>
            <div className="text-[11px] text-stone-400">ระบบจัดการหลังร้าน (POS/KDS)</div>
          </div>
        </div>

        {/* Push Notification Toggle */}
        <div className="hidden md:flex items-center">
          <PushNotificationPrompt shopId={shopId} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Link
            href="/superadmin"
            className="text-stone-500 hover:text-amber-800 text-xs flex items-center gap-1.5 p-2 rounded-xl hover:bg-amber-50/80 transition-colors"
            title="ศูนย์ควบคุม Superadmin"
          >
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline font-semibold">Superadmin</span>
          </Link>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1.5 p-2 rounded-xl hover:bg-stone-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 overflow-x-auto flex gap-1 border-t border-stone-100 no-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-amber-600 text-amber-800'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
