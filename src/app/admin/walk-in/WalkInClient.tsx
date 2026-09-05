'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shop, Category, MenuItem, Option, CartItem } from '@/lib/types';
import { OptionModal } from '@/components/customer/OptionModal';
import { createPickupOrderAction } from '@/app/actions/order';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Banknote,
  CreditCard,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';

interface WalkInClientProps {
  shop: Shop;
  categories: Category[];
  menuItems: MenuItem[];
}

export function WalkInClient({ shop, categories, menuItems }: WalkInClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeItemForModal, setActiveItemForModal] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'cash'>('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);

  const handleAddToCart = (
    item: MenuItem,
    qty: number,
    selectedOptions: Option[],
    itemNote: string
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
      note: itemNote.trim() || undefined,
      line_total: lineTotal,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((_, i) => i !== index));
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
        return { ...item, qty: newQty, line_total: unitPrice * newQty };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);

  const handleSubmitWalkInOrder = async () => {
    if (cart.length === 0) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessOrderNo(null);

    const itemsPayload = cart.map((item) => ({
      menu_item_id: item.menu_item_id,
      qty: item.qty,
      option_ids: item.selected_options.map((o) => o.id),
      note: item.note,
    }));

    const result = await createPickupOrderAction({
      shop_id: shop.id,
      type: 'takeaway',
      customer_phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      source: 'staff',
      payment_method: paymentMethod,
      items: itemsPayload,
    });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'เกิดข้อผิดพลาดในการสั่ง');
      return;
    }

    setSuccessOrderNo(result.data?.order_no || 'สำเร็จ');
    setCart([]);
    setPhone('');
    setNote('');
  };

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((i) => i.category_id === selectedCategory);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Menu Selection */}
      <div className="lg:col-span-2 space-y-4">
        {/* Category Pills */}
        <div className="overflow-x-auto flex gap-2 pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200'
            }`}
          >
            ทั้งหมด
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveItemForModal(item)}
              className="bg-white p-3.5 rounded-2xl border border-stone-200/80 hover:border-amber-400 shadow-xs cursor-pointer flex flex-col justify-between space-y-2 group transition-all"
            >
              <div>
                <div className="font-bold text-stone-900 text-xs sm:text-sm group-hover:text-amber-800 line-clamp-1">
                  {item.name}
                </div>
                {item.description && (
                  <div className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                    {item.description}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-extrabold text-amber-700 text-sm">
                  {Number(item.price).toLocaleString('th-TH')} ฿
                </span>
                <span className="w-6 h-6 rounded-lg bg-amber-50 group-hover:bg-amber-600 group-hover:text-white text-amber-700 flex items-center justify-center transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Col: Walk-in Cart & Checkout */}
      <div className="space-y-4">
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs space-y-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>รายการอาหารหน้าร้าน</span>
            </div>
            <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.qty, 0)} จาน
            </span>
          </div>

          {successOrderNo && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>บันทึกออเดอร์ #{successOrderNo} เรียบร้อยแล้ว!</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400">
                ยังไม่ได้เลือกอาหาร (กดเลือกจากเมนูด้านซ้าย)
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="py-2.5 space-y-1 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-stone-800">{item.name}</span>
                    <span className="font-bold text-stone-900">
                      {item.line_total.toLocaleString('th-TH')} ฿
                    </span>
                  </div>
                  {item.selected_options.length > 0 && (
                    <div className="text-[11px] text-stone-500">
                      + {item.selected_options.map((o) => o.name).join(', ')}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-stone-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2 bg-stone-100 p-0.5 rounded-lg">
                      <button
                        onClick={() => handleUpdateQty(idx, item.qty - 1)}
                        className="w-5 h-5 flex items-center justify-center bg-white rounded text-stone-700 hover:bg-stone-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-bold text-xs">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(idx, item.qty + 1)}
                        className="w-5 h-5 flex items-center justify-center bg-white rounded text-stone-700 hover:bg-stone-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Inputs */}
          <div className="space-y-3 pt-2 border-t border-stone-100 text-xs">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">เบอร์โทรลูกค้า (ถ้ามี)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="font-semibold text-stone-700 block mb-1">การชำระเงิน</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>เงินสด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('promptpay')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all ${
                    paymentMethod === 'promptpay'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>พร้อมเพย์</span>
                </button>
              </div>
            </div>
          </div>

          {/* Total & Submit */}
          <div className="pt-3 border-t border-stone-100 space-y-3">
            <div className="flex justify-between items-center text-sm font-bold text-stone-900">
              <span>ยอดรวมทั้งสิ้น</span>
              <span className="text-base text-amber-700">
                {subtotal.toLocaleString('th-TH')} ฿
              </span>
            </div>

            <button
              type="button"
              disabled={isLoading || cart.length === 0}
              onClick={handleSubmitWalkInOrder}
              className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>เปิดบิลหน้าร้าน ({subtotal.toLocaleString('th-TH')} ฿)</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Option Customization Modal */}
      <OptionModal
        item={activeItemForModal}
        onClose={() => setActiveItemForModal(null)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
