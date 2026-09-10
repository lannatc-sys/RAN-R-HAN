'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shop, Category, MenuItem, Option, CartItem } from '@/lib/types';
import { OptionModal } from '@/components/customer/OptionModal';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { ShoppingBag, Plus, Clock, Store } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HeaderControls } from '@/components/common/HeaderControls';

interface MenuClientProps {
  shop: Shop;
  categories: Category[];
  menuItems: MenuItem[];
}

export function MenuClient({ shop, categories, menuItems }: MenuClientProps) {
  const { t, lang } = useLanguage();
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
    <div className="min-h-screen pb-32 transition-colors">
      {/* Shop Header */}
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200/70 dark:border-stone-800 sticky top-0 z-30 shadow-xs transition-colors">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {shop.logo_url || shop.logo ? (
              <img
                src={shop.logo_url || shop.logo || ''}
                alt={shop.name}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-stone-100 dark:border-stone-800 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                <Store className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base leading-snug truncate">
                {shop.name}
              </h1>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-stone-500 dark:text-stone-400">
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {lang === 'th' ? 'เปิดรับออเดอร์' : 'Open'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5 truncate">
                  <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                  <span>{lang === 'th' ? 'สั่งอาหารออนไลน์' : 'Online Orders'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Theme & Language Controls */}
          <HeaderControls />
        </div>

        {/* Category Pills Navigation */}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 overflow-x-auto flex gap-1.5 sm:gap-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/80 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            {t.menu.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/80 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Menu List */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 space-y-2.5 sm:space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-stone-400 dark:text-stone-500 text-sm">
            {lang === 'th' ? 'ยังไม่มีรายการอาหารในหมวดหมู่นี้' : 'No menu items in this category.'}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveItemForModal(item)}
              className="flex items-center justify-between p-3.5 sm:p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex-1 pr-3 sm:pr-4 space-y-1 min-w-0">
                <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors truncate">
                  {item.name}
                </div>
                {item.description && (
                  <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
                <div className="text-xs sm:text-sm font-extrabold text-amber-700 dark:text-amber-400 pt-0.5 sm:pt-1">
                  {Number(item.price).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
                </div>
              </div>

              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300 dark:text-stone-600">
                    <Store className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                )}
                <button
                  type="button"
                  className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 w-6 h-6 sm:w-7 sm:h-7 bg-amber-600 text-white rounded-lg flex items-center justify-center shadow-md shadow-amber-900/30 hover:bg-amber-700 transition-colors"
                  aria-label={t.menu.addToCart}
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          ))
        )}

        {/* Legal & Policy Footer */}
        <footer className="mt-12 pt-8 pb-16 border-t border-stone-200 dark:border-stone-800 text-center text-xs text-stone-400 dark:text-stone-500 space-y-2">
          <div className="flex items-center justify-center gap-4">
            <Link
              href={`/${shop.slug}/terms`}
              className="hover:text-stone-700 dark:hover:text-stone-300 transition underline underline-offset-4"
            >
              ข้อกำหนดการใช้งาน
            </Link>
            <span>•</span>
            <Link
              href={`/${shop.slug}/privacy`}
              className="hover:text-stone-700 dark:hover:text-stone-300 transition underline underline-offset-4"
            >
              นโยบายความเป็นส่วนตัว (PDPA)
            </Link>
          </div>
          <p>© 2026 {shop.name} • ขับเคลื่อนโดยแพลตฟอร์ม RAN-R-HAN</p>
        </footer>
      </main>

      {/* Sticky Bottom Cart Bar with Safe Area */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-3 sm:p-4 z-40 bg-gradient-to-t from-[#fcf9f6] dark:from-[#0c0a09] via-[#fcf9f6]/95 dark:via-[#0c0a09]/95 to-transparent pb-safe">
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="w-full py-3.5 sm:py-4 px-5 sm:px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl shadow-xl shadow-amber-600/30 flex items-center justify-between transition-all transform active:scale-[0.99] min-h-[44px]"
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="absolute -top-1.5 -right-2 bg-white text-amber-700 text-[10px] sm:text-[11px] font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-xs">
                    {totalCartQty}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold">{t.menu.viewCart}</span>
              </div>
              <span className="text-base sm:text-lg font-bold">
                {totalCartAmount.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
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
