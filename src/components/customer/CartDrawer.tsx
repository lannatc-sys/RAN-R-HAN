'use client';

import { CartItem } from '@/lib/types';
import { ShoppingBag, X, Plus, Minus, ArrowRight, Trash2 } from 'lucide-react';
import Link from 'next/link';

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
  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);
  const totalItemsCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-stone-900">ตะกร้าอาหาร</h2>
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
              {totalItemsCount} รายการ
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 divide-y divide-stone-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-3">
              <ShoppingBag className="w-16 h-16 stroke-1 text-stone-300" />
              <div className="font-medium text-stone-600">ยังไม่มีรายการอาหารในตะกร้า</div>
              <div className="text-xs text-stone-400">เลือกอาหารอร่อยๆ จากเมนูด้านหลังได้เลย</div>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-stone-900 text-sm">{item.name}</div>
                    {item.selected_options.length > 0 && (
                      <div className="text-xs text-stone-500 mt-0.5">
                        {item.selected_options.map((o) => o.name).join(', ')}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-0.5 mt-1 inline-block">
                        โน้ต: {item.note}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-stone-900">
                    {item.line_total.toLocaleString('th-TH')} ฿
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => onRemoveItem(idx)}
                    className="text-stone-400 hover:text-red-500 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบ</span>
                  </button>

                  <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
                    <button
                      onClick={() => onUpdateQty(idx, item.qty - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white text-stone-700 shadow-xs hover:bg-stone-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-stone-800">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(idx, item.qty + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white text-stone-700 shadow-xs hover:bg-stone-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-stone-100 bg-stone-50 space-y-4">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-stone-600">ยอดรวมทั้งสิ้น</span>
              <span className="text-xl font-bold text-stone-900">
                {totalAmount.toLocaleString('th-TH')} ฿
              </span>
            </div>

            <Link
              href={`/${shopSlug}/checkout`}
              className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-between transition-all group"
            >
              <span>ไปที่หน้าชำระเงิน</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
