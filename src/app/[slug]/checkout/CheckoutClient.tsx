'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shop, CartItem } from '@/lib/types';
import { createPickupOrderAction } from '@/app/actions/order';
import { ArrowLeft, Phone, Clock, CreditCard, Banknote, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface CheckoutClientProps {
  shop: Shop;
}

export function CheckoutClient({ shop }: CheckoutClientProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [phone, setPhone] = useState('');
  const [pickupMinutes, setPickupMinutes] = useState<number>(15);
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'cash'>('promptpay');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cart_${shop.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length === 0) {
          router.push(`/${shop.slug}`);
        } else {
          setCart(parsed);
        }
      } else {
        router.push(`/${shop.slug}`);
      }
    } catch (e) {
      console.error(e);
    }
  }, [shop.id, shop.slug, router]);

  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);

  // คำนวณ Service charge และ VAT ตามการตั้งค่าของร้านค้า
  let serviceChargeAmount = 0;
  if (shop.service_charge > 0) {
    serviceChargeAmount = Math.round(subtotal * (shop.service_charge / 100) * 100) / 100;
  }

  let vatAmount = 0;
  let finalTotal = subtotal + serviceChargeAmount;

  if (shop.vat_mode === 'exclusive') {
    vatAmount = Math.round((subtotal + serviceChargeAmount) * 0.07 * 100) / 100;
    finalTotal += vatAmount;
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!phone || phone.trim().length < 9) {
      setErrorMessage('กรุณาระบุเบอร์โทรศัพท์อย่างน้อย 9 หลัก เพื่อใช้ติดต่อรับอาหาร');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const pickupDate = new Date();
    pickupDate.setMinutes(pickupDate.getMinutes() + pickupMinutes);

    const itemsPayload = cart.map((item) => ({
      menu_item_id: item.menu_item_id,
      qty: item.qty,
      option_ids: item.selected_options.map((o) => o.id),
      note: item.note,
    }));

    const result = await createPickupOrderAction({
      shop_id: shop.id,
      customer_phone: phone.trim(),
      pickup_at: pickupDate.toISOString(),
      note: note.trim() || undefined,
      source: 'customer',
      payment_method: paymentMethod,
      items: itemsPayload,
    });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'ไม่สามารถสร้างคำสั่งซื้อได้');
      return;
    }

    // ล้างตะกร้าของร้านนี้
    localStorage.removeItem(`cart_${shop.id}`);

    // นำทางไปยังหน้าติดตามสถานะออเดอร์
    router.push(`/order/${result.data?.order_id}`);
  };

  return (
    <div className="min-h-screen pb-20 bg-stone-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-stone-200/70 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <Link
            href={`/${shop.slug}`}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-stone-900 text-base">ชำระเงินและรับอาหาร</h1>
            <p className="text-xs text-stone-500">{shop.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-4">
          {/* Customer Info Card */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Phone className="w-4 h-4 text-amber-600" />
              <span>ข้อมูลผู้สั่งอาหาร</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                เบอร์โทรศัพท์สำหรับรับอาหาร <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 0812345678"
                className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                maxLength={10}
                required
              />
            </div>

            {/* Estimated Pickup Time */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                เวลามารับอาหารโดยประมาณ
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPickupMinutes(mins)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      pickupMinutes === mins
                        ? 'border-amber-500 bg-amber-50/70 text-amber-800'
                        : 'border-stone-200 hover:border-stone-300 text-stone-600'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>อีก {mins} นาที</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note to Kitchen */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                หมายเหตุเพิ่มเติมถึงร้าน
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ขอช้อนส้อม, แยกน้ำ..."
                className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                maxLength={200}
              />
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-4">
            <div className="text-stone-900 font-bold text-sm">เลือกวิธีชำระเงิน</div>

            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setPaymentMethod('promptpay')}
                className={`p-4 rounded-2xl border cursor-pointer flex flex-col items-center text-center gap-2 transition-all ${
                  paymentMethod === 'promptpay'
                    ? 'border-amber-500 bg-amber-50/60 text-stone-900'
                    : 'border-stone-200 hover:border-stone-300 text-stone-600'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'promptpay'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">โอนพร้อมเพย์</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">ตรวจสลิปอัตโนมัติ</div>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 rounded-2xl border cursor-pointer flex flex-col items-center text-center gap-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-amber-500 bg-amber-50/60 text-stone-900'
                    : 'border-stone-200 hover:border-stone-300 text-stone-600'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'cash'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">เงินสดตอนรับที่ร้าน</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">จ่ายเมื่อมารับอาหาร</div>
                </div>
              </label>
            </div>
          </div>

          {/* Order Summary Card */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-3">
            <div className="text-stone-900 font-bold text-sm">สรุปรายการ ({cart.length} รายการ)</div>

            <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto">
              {cart.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-stone-800">{item.name}</span>
                    <span className="text-stone-400 ml-1.5">x{item.qty}</span>
                    {item.selected_options.length > 0 && (
                      <div className="text-[11px] text-stone-400">
                        {item.selected_options.map((o) => o.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-stone-900">
                    {item.line_total.toLocaleString('th-TH')} ฿
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-stone-100 space-y-1.5 text-xs text-stone-500">
              <div className="flex justify-between">
                <span>ยอดรวมอาหาร</span>
                <span>{subtotal.toLocaleString('th-TH')} ฿</span>
              </div>
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>ค่าบริการ ({shop.service_charge}%)</span>
                  <span>{serviceChargeAmount.toLocaleString('th-TH')} ฿</span>
                </div>
              )}
              {vatAmount > 0 && (
                <div className="flex justify-between">
                  <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                  <span>{vatAmount.toLocaleString('th-TH')} ฿</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-100">
                <span>ยอดชำระสุทธิ</span>
                <span className="text-base text-amber-700">
                  {finalTotal.toLocaleString('th-TH')} ฿
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || cart.length === 0}
            className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 transition-all text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>กำลังส่งคำสั่งซื้อ...</span>
              </>
            ) : (
              <span>ยืนยันการสั่งอาหาร ({finalTotal.toLocaleString('th-TH')} ฿)</span>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
