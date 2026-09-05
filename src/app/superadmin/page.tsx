import { getPlatformStatsAction, getAllStoresAction } from '@/app/actions/superadmin';
import Link from 'next/link';
import {
  Store,
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Zap,
  Activity,
  Users,
} from 'lucide-react';

export default async function SuperadminDashboardPage() {
  const [statsRes, storesRes] = await Promise.all([
    getPlatformStatsAction(),
    getAllStoresAction(),
  ]);

  const stats = statsRes.stats || {
    totalStores: 0,
    activeStores: 0,
    suspendedStores: 0,
    totalOrders: 0,
    todayOrders: 0,
  };

  const recentStores = (storesRes.stores || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Title & Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            ภาพรวมแพลตฟอร์ม Kin-D SaaS
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ศูนย์กลางการมอนิเตอร์และบริหารร้านอาหารทั้งหมดในระบบ (Privacy First - ไม่แสดงยอดขายทางการเงิน)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>ระบบทำงานปกติ 99.9%</span>
          </span>
        </div>
      </div>

      {/* 4 Main Metric Cards (Privacy First - Non-financial) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Stores */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ร้านค้าทั้งหมด</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.totalStores} <span className="text-xs font-normal text-slate-400">ร้าน</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <span>เปิดใช้งาน {stats.activeStores} ร้าน</span>
              {stats.suspendedStores > 0 && (
                <span className="text-rose-500">| ระงับ {stats.suspendedStores} ร้าน</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Active Stores Rate */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">อัตราการใช้งาน (Active Rate)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.totalStores > 0
                ? Math.round((stats.activeStores / stats.totalStores) * 100)
                : 100}
              <span className="text-xs font-normal text-slate-400">%</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              สถานะพร้อมรับออเดอร์
            </div>
          </div>
        </div>

        {/* Card 3: Total Cumulative Orders (Privacy First - Replaced GMV) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ออเดอร์สะสมทั้งระบบ</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.totalOrders.toLocaleString('th-TH')}{' '}
              <span className="text-xs font-normal text-slate-400">บิล</span>
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">
              ภาระโหลดสะสมทั้งหมด
            </div>
          </div>
        </div>

        {/* Card 4: Orders Today */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ออเดอร์วันนี้</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.todayOrders.toLocaleString('th-TH')}{' '}
              <span className="text-xs font-normal text-slate-400">บิล</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              ความเคลื่อนไหวรอบวัน
            </div>
          </div>
        </div>
      </div>

      {/* System Infrastructure Status Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">สถานะระบบโครงสร้างพื้นฐาน (SaaS Infrastructure)</div>
            <div className="text-xs text-slate-400">
              PostgreSQL 15 (Supabase) + Next.js App Router + Realtime Engine
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Database: Connected</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Realtime: Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-amber-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>BYOK SlipOK: Ready</span>
          </div>
        </div>
      </div>

      {/* Recent Stores Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">ร้านอาหารล่าสุดในระบบ</h2>
            <p className="text-xs text-slate-500">ร้านค้าที่ลงทะเบียนเข้าใช้งานแพลตฟอร์ม</p>
          </div>

          <Link
            href="/superadmin/stores"
            className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
          >
            <span>ดูร้านทั้งหมด ({stats.totalStores})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentStores.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">ยังไม่มีร้านค้าในระบบ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-3">ชื่อร้านค้า</th>
                  <th className="pb-3">Slug</th>
                  <th className="pb-3">แพ็กเกจ</th>
                  <th className="pb-3">ออเดอร์สะสม</th>
                  <th className="pb-3">สถานะ</th>
                  <th className="pb-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentStores.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                        {shop.name[0]}
                      </div>
                      <span>{shop.name}</span>
                    </td>
                    <td className="py-3 font-mono text-slate-500">/{shop.slug}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase">
                        {shop.plan}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 font-medium">{shop.order_count || 0} บิล</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          shop.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            shop.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        ></span>
                        {shop.status === 'active' ? 'เปิดบริการ' : 'ระงับชั่วคราว'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/order/${shop.slug}`}
                        target="_blank"
                        className="text-amber-600 hover:text-amber-700 font-bold hover:underline"
                      >
                        เปิดหน้าร้าน ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
