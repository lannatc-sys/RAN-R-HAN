'use client';

import { useState } from 'react';
import { Shop, Category, MenuItem } from '@/lib/types';
import {
  toggleMenuItemAvailabilityAction,
  createMenuItemAction,
  createCategoryAction,
} from '@/app/actions/menu';
import { Plus, Check, X, Store, Loader2 } from 'lucide-react';

interface MenuManagementClientProps {
  shop: Shop;
  categories: Category[];
  initialMenuItems: MenuItem[];
}

export function MenuManagementClient({
  shop,
  categories,
  initialMenuItems,
}: MenuManagementClientProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishCat, setNewDishCat] = useState<string>('');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const handleToggleAvailable = async (item: MenuItem) => {
    setLoadingItemId(item.id);
    const res = await toggleMenuItemAvailabilityAction(item.id, item.is_available);
    if (res.success) {
      setMenuItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i))
      );
    }
    setLoadingItemId(null);
  };

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName || !newDishPrice) return;

    const res = await createMenuItemAction({
      shop_id: shop.id,
      category_id: newDishCat || null,
      name: newDishName,
      price: parseFloat(newDishPrice),
      description: newDishDesc,
    });

    if (res.success) {
      setIsAddDishOpen(false);
      setNewDishName('');
      setNewDishPrice('');
      setNewDishDesc('');
      window.location.reload();
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    const res = await createCategoryAction(shop.id, newCatName);
    if (res.success) {
      setIsAddCatOpen(false);
      setNewCatName('');
      window.location.reload();
    }
  };

  const filtered =
    selectedCat === 'all'
      ? menuItems
      : menuItems.filter((i) => i.category_id === selectedCat);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">จัดการรายการอาหาร</h1>
          <p className="text-xs text-stone-500">เปิด-ปิดรายการอาหารที่หมดชั่วคราว หรือเพิ่มเมนูใหม่</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddCatOpen(true)}
            className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มหมวดหมู่</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddDishOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มเมนูอาหาร</span>
          </button>
        </div>
      </div>

      {/* Categories Filter Pills */}
      <div className="overflow-x-auto flex gap-2 pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCat('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            selectedCat === 'all'
              ? 'bg-amber-600 text-white'
              : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200'
          }`}
        >
          ทั้งหมด ({menuItems.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              selectedCat === cat.id
                ? 'bg-amber-600 text-white'
                : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200'
            }`}
          >
            {cat.name} ({menuItems.filter((i) => i.category_id === cat.id).length})
          </button>
        ))}
      </div>

      {/* Menu Table / Cards */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs divide-y divide-stone-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">ยังไม่มีรายการอาหาร</div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                !item.is_available ? 'bg-stone-50/70 opacity-60' : 'hover:bg-amber-50/20'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-5 h-5 text-stone-300" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-stone-900 text-sm truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-stone-400 truncate">{item.description}</div>
                  )}
                  <div className="text-xs font-extrabold text-amber-700 mt-0.5">
                    {Number(item.price).toLocaleString('th-TH')} ฿
                  </div>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingItemId === item.id}
                  onClick={() => handleToggleAvailable(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    item.is_available
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  {loadingItemId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : item.is_available ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  <span>{item.is_available ? 'มีขาย' : 'หมดชั่วคราว'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Add Category */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAddCategory}
            className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-stone-900 text-base">เพิ่มหมวดหมู่ใหม่</h3>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="ชื่อหมวดหมู่ เช่น เมนูข้าว, เครื่องดื่ม"
              required
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCatOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold"
              >
                บันทึก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Dish */}
      {isAddDishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAddDish}
            className="w-full max-w-md bg-white p-6 rounded-3xl shadow-2xl space-y-3"
          >
            <h3 className="font-bold text-stone-900 text-base">เพิ่มเมนูอาหารใหม่</h3>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">ชื่อเมนู</label>
              <input
                type="text"
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                placeholder="เช่น ข้าวกะเพราหมูกรอบ"
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">ราคา (บาท)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newDishPrice}
                  onChange={(e) => setNewDishPrice(e.target.value)}
                  placeholder="60"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">หมวดหมู่</label>
                <select
                  value={newDishCat}
                  onChange={(e) => setNewDishCat(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">รายละเอียด</label>
              <input
                type="text"
                value={newDishDesc}
                onChange={(e) => setNewDishDesc(e.target.value)}
                placeholder="คำอธิบายสั้นๆ"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsAddDishOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold"
              >
                บันทึกเมนู
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
