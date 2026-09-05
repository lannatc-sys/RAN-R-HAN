'use client';

import { useState, useEffect } from 'react';
import { Shop, Category, MenuItem, Option, CartItem } from '@/lib/types';
import { OptionModal } from '@/components/customer/OptionModal';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { ShoppingBag, Plus, Clock, MapPin, Store } from 'lucide-react';

interface MenuClientProps {
  shop: Shop;
  categories: Category[];
  menuItems: MenuItem[];
}

export function MenuClient({ shop, categories, menuItems }: MenuClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeItemForModal, setActiveItemForModal] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  // โหลดตะกร้าจาก localStorage เมื่อเปิดหน้า
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cart_${shop.id}`);
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load cart from localStorage', e);
    }
  }, [shop.id]);

  // บันทึกตะกร้าลง localStorage เมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    try {
      localStorage.setItem(`cart_${shop.id}`, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart, shop.id]);

  const handleAddToCart = (
    item: MenuItem,
    qty: number,
    selectedOptions: Option[],
    note: string
  ) => {
    const optionsDelta = selectedOptions.reduce((sum, o) => sum + Number(o.price_delta), 0);
    const unitPrice = Number(item.price) + optionsDelta;
    const lineTotal = unitPrice * qty;

    const newItem: CartItem = {
      menu_item_id: item.id,
      name: item.name,
      base_price: Number(item.price),
      qty,
      selected_options: selectedOptions,
      note: note.trim() || undefined,
      line_total: lineTotal,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const optionsDelta = item.selected_options.reduce(
          (sum, o) => sum + Number(o.price_delta),
          0
        );
        const unitPrice = item.base_price + optionsDelta;
        return {
          ...item,
          qty: newQty,
          line_total: unitPrice * newQty,
        };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((item) => item.category_id === selectedCategory);

  const totalCartQty = cart.reduce((sum, i) => sum + i.qty, 0);
  const totalCartAmount = cart.reduce((sum, i) => sum + i.line_total, 0);

  return (
    <div className="min-h-screen pb-32">
      {/* Shop Header */}
      <header className="bg-white border-b border-stone-200/70 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo ? (
              <img
                src={shop.logo}
                alt={shop.name}
                className="w-11 h-11 rounded-2xl object-cover border border-stone-100 shadow-xs"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                <Store className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-stone-900 text-base leading-snug">{shop.name}</h1>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  เปิดรับออเดอร์
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3 text-stone-400" />
                  สั่งรับที่ร้าน
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills Navigation */}
        <div className="max-w-3xl mx-auto px-4 py-2.5 overflow-x-auto flex gap-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200/80 text-stone-600'
            }`}
          >
            ทั้งหมด
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200/80 text-stone-600'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Menu List */}
      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            ยังไม่มีรายการอาหารในหมวดหมู่นี้
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveItemForModal(item)}
              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200/70 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex-1 pr-4 space-y-1">
                <div className="font-bold text-stone-900 text-sm group-hover:text-amber-800 transition-colors">
                  {item.name}
                </div>
                {item.description && (
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
                <div className="text-sm font-extrabold text-amber-700 pt-1">
                  {Number(item.price).toLocaleString('th-TH')} ฿
                </div>
              </div>

              <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <Store className="w-8 h-8" />
                  </div>
                )}
                <button
                  type="button"
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md shadow-amber-900/30 hover:bg-amber-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Sticky Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 z-40 bg-gradient-to-t from-white via-white/95 to-transparent">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl shadow-xl shadow-amber-600/30 flex items-center justify-between transition-all transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="w-6 h-6" />
                  <span className="absolute -top-1.5 -right-2 bg-white text-amber-700 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs">
                    {totalCartQty}
                  </span>
                </div>
                <span>ดูตะกร้าอาหาร</span>
              </div>
              <span className="text-lg font-bold">
                {totalCartAmount.toLocaleString('th-TH')} ฿
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Option Customization Modal */}
      <OptionModal
        item={activeItemForModal}
        onClose={() => setActiveItemForModal(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart Slide-over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        shopSlug={shop.slug}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
      />
    </div>
  );
}
