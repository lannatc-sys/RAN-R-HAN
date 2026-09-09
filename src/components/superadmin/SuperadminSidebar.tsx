'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  BellRing,
  LogOut,
  ArrowUpRight,
  ShieldAlert,
  Layers,
  Sparkles,
} from 'lucide-react';

export function SuperadminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    {
      href: '/superadmin',
      label: 'ภาพรวมแพลตฟอร์ม',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/superadmin/stores',
      label: 'ร้านค้าทั้งหมด',
      icon: Store,
      exact: false,
    },
    {
      href: '/superadmin/plans',
      label: 'แพ็กเกจ & ค่าบริการ',
      icon: CreditCard,
      exact: false,
    },
    {
      href: '/superadmin/announcements',
      label: 'ประกาศระบบ',
      icon: BellRing,
      exact: false,
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-slate-200 min-h-screen flex flex-col justify-between p-4 border-r border-slate-800/80 shrink-0">
      {/* Top Segment: Brand & Nav */}
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-amber-500/20">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-tight text-sm">RAN-R-HAN</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="text-[11px] text-amber-400 font-medium">Super Admin Console</div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 px-3 uppercase tracking-wider mb-2">
            การจัดการระบบกลาง
          </div>
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border-l-4 border-amber-500 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Segment */}
      <div className="space-y-3 pt-6 border-t border-slate-800/80">
        {/* Switch to Store POS */}
        <Link
          href="/admin/orders"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-amber-500" />
            <span>ไปหน้าร้าน POS/KDS</span>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </Link>

        {/* Platform Status Info */}
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>สถานะระบบ: ปกติ (Active)</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">SaaS Architecture v1.0</div>
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 text-xs font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>ออกจากระบบ Superadmin</span>
        </button>
      </div>
    </aside>
  );
}
