'use client';

import { CartItem } from '@/lib/types';
import { ShoppingBag, X, Plus, Minus, ArrowRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  shopSlug: string;
  onUpdateQty: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  shopSlug,
  onUpdateQty,
  onRemoveItem,
}: CartDrawerProps) {
  const { t, lang } = useLanguage();

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);
  const totalItemsCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 border-l border-transparent dark:border-stone-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              {t.cart.title}
            </h2>
            <span className="text-xs bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full">
              {totalItemsCount} {t.common.items}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
            aria-label={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-stone-100 dark:divide-stone-800">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 dark:text-stone-500 space-y-3">
              <ShoppingBag className="w-16 h-16 stroke-1 text-stone-300 dark:text-stone-700" />
              <div className="font-medium text-stone-600 dark:text-stone-300 text-sm sm:text-base">
                {t.cart.emptyTitle}
              </div>
              <div className="text-xs text-stone-400 dark:text-stone-500">
                {t.cart.emptyDesc}
              </div>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="py-3.5 sm:py-4 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-900 dark:text-stone-100 text-xs sm:text-sm truncate">
                      {item.name}
                    </div>
                    {item.selected_options.length > 0 && (
                      <div className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        {item.selected_options.map((o) => o.name).join(', ')}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md px-2 py-0.5 mt-1 inline-block">
                        {t.common.note}: {item.note}
                      </div>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shrink-0">
                    {item.line_total.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(idx)}
                    className="text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.cart.removeItem}</span>
                  </button>

                  <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(idx, item.qty - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 shadow-xs hover:bg-stone-50 dark:hover:bg-stone-600 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-stone-800 dark:text-stone-100">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(idx, item.qty + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 shadow-xs hover:bg-stone-50 dark:hover:bg-stone-600 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Safe Area */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 space-y-3 pb-safe">
            <div className="flex items-center justify-between text-sm sm:text-base">
              <span className="font-medium text-stone-600 dark:text-stone-400">
                {t.common.total}
              </span>
              <span className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
                {totalAmount.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
              </span>
            </div>

            <Link
              href={`/${shopSlug}/checkout`}
              className="w-full py-3.5 sm:py-4 px-5 sm:px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-between transition-all group min-h-[44px]"
            >
              <span>{t.cart.checkoutBtn}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
