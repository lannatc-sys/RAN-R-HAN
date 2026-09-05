'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateStoreStatusAction,
  updateStorePlanAction,
  impersonateStoreAction,
} from '@/app/actions/superadmin';
import type { Shop, ShopStatus } from '@/lib/types';
import {
  Store,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ExternalLink,
  Edit2,
  Loader2,
  Check,
  AlertCircle,
  LogIn,
} from 'lucide-react';

interface StoreItem extends Shop {
  order_count?: number;
  revenue?: number;
}

interface StoresManagementClientProps {
  initialStores: StoreItem[];
}

export function StoresManagementClient({ initialStores }: StoresManagementClientProps) {
  const router = useRouter();
  const [stores, setStores] = useState<StoreItem[]>(initialStores);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingShopId, setLoadingShopId] = useState<string | null>(null);

  // Edit Plan Modal State
  const [editingShop, setEditingShop] = useState<StoreItem | null>(null);
  const [newPlan, setNewPlan] = useState<string>('standard');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Filter stores locally for quick response
  const filteredStores = stores.filter((shop) => {
    const matchesSearch =
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shop.phone && shop.phone.includes(searchQuery));

    const matchesStatus =
      statusFilter === 'all' ? true : shop.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = async (shop: StoreItem) => {
    const nextStatus: ShopStatus = shop.status === 'active' ? 'suspended' : 'active';
    const confirmText =
      nextStatus === 'suspended'
        ? `คุณต้องการ "ระงับการใช้งาน" ร้าน ${shop.name} ใช่หรือไม่? (หน้าร้านและ KDS จะเข้าใช้งานไม่ได้ชั่วคราว)`
        : `คุณต้องการ "เปิดใช้งาน" ร้าน ${shop.name} ใช่หรือไม่?`;

    if (!window.confirm(confirmText)) return;

    setLoadingShopId(shop.id);
    const res = await updateStoreStatusAction(shop.id, nextStatus);
    setLoadingShopId(null);

    if (res.success) {
      setStores((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, status: nextStatus, is_active: nextStatus === 'active' } : s))
      );
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะร้าน');
    }
  };

  const handleImpersonate = async (shopId: string) => {
    setLoadingShopId(shopId);
    await impersonateStoreAction(shopId);
    router.push('/admin/orders');
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    setIsSavingPlan(true);
    const res = await updateStorePlanAction(editingShop.id, newPlan);
    setIsSavingPlan(false);

    if (res.success) {
      setStores((prev) =>
        prev.map((s) => (s.id === editingShop.id ? { ...s, plan: newPlan } : s))
      );
      setEditingShop(null);
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกแพ็กเกจ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            จัดการร้านค้าทั้งหมด (All Stores Directory)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            รายชื่อร้านอาหารทั้งหมดบนแพลตฟอร์ม ควบคุมสถานะและเข้าจัดการรายร้าน
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาตามชื่อร้าน, Slug, หรือเบอร์โทร..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="active">เปิดบริการ (Active)</option>
            <option value="suspended">ระงับชั่วคราว (Suspended)</option>
            <option value="expired">หมดอายุ (Expired)</option>
          </select>
        </div>
      </div>

      {/* Stores Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold">
                <th className="py-3.5 px-4">ร้านอาหาร</th>
                <th className="py-3.5 px-4">Slug / Link</th>
                <th className="py-3.5 px-4">เบอร์โทร</th>
                <th className="py-3.5 px-4">แพ็กเกจ</th>
                <th className="py-3.5 px-4">ออเดอร์สะสม</th>
                <th className="py-3.5 px-4">ยอดขาย (GMV)</th>
                <th className="py-3.5 px-4">สถานะ</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    ไม่พบร้านอาหารที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                filteredStores.map((shop) => {
                  const isLoading = loadingShopId === shop.id;

                  return (
                    <tr key={shop.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Logo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                            {shop.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{shop.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {shop.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        <a
                          href={`/order/${shop.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-amber-600 flex items-center gap-1 group"
                        >
                          <span>/{shop.slug}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        {shop.phone || '-'}
                      </td>

                      {/* Plan */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShop(shop);
                            setNewPlan(shop.plan || 'basic');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase transition-colors cursor-pointer"
                        >
                          <span>{shop.plan}</span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-400" />
                        </button>
                      </td>

                      {/* Orders */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {shop.order_count || 0} บิล
                      </td>

                      {/* Revenue */}
                      <td className="py-3.5 px-4 font-black text-slate-900">
                        {Number(shop.revenue || 0).toLocaleString('th-TH')} ฿
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
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
                          <span>{shop.status === 'active' ? 'เปิดบริการ' : 'ระงับชั่วคราว'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Impersonate */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleImpersonate(shop.id)}
                            title="สวมรอยเข้าจัดการร้านค้านี้ (POS/KDS)"
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">เข้าจัดการ</span>
                          </button>

                          {/* Toggle Status */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleToggleStatus(shop)}
                            title={shop.status === 'active' ? 'ระงับร้านนี้' : 'เปิดใช้งานร้านนี้'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              shop.status === 'active'
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : shop.status === 'active' ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit Plan */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">เปลี่ยนแพ็กเกจร้านค้า</h3>
              <p className="text-xs text-slate-500 mt-0.5">ร้าน: {editingShop.name}</p>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลือกระดับแพ็กเกจ (SaaS Plan)
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="basic">Basic (ทดลองใช้ / ไม่เกิน 50 บิล)</option>
                  <option value="standard">Standard (ร้านขนาดกลาง)</option>
                  <option value="pro">Pro (ไม่จำกัดบิล + Realtime)</option>
                  <option value="enterprise">Enterprise (กำหนดเอง)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                >
                  {isSavingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>บันทึกแพ็กเกจ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
