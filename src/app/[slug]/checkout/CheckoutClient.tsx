'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shop, CartItem } from '@/lib/types';
import { createPickupOrderAction } from '@/app/actions/order';
import {
  ArrowLeft,
  Phone,
  Clock,
  CreditCard,
  Banknote,
  AlertCircle,
  Loader2,
  Store,
  Bike,
  MapPin,
  LocateFixed,
  Check,
  User,
} from 'lucide-react';
import Link from 'next/link';

interface CheckoutClientProps {
  shop: Shop;
}

export function CheckoutClient({ shop }: CheckoutClientProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
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

  // ดึงพิกัด GPS ผ่าน HTML5 Geolocation API
  const handleGetGPS = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('อุปกรณ์หรือเบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS');
      return;
    }

    setIsGettingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setDeliveryLat(lat);
        setDeliveryLng(lng);
        setGpsSuccess(true);
        setIsGettingGps(false);
      },
      (error) => {
        setIsGettingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์ หรือพิมพ์ที่อยู่จัดส่งด้านบน');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsError('ไม่สามารถระบุพิกัดได้ในขณะนี้ กรุณากรอกที่อยู่จัดส่งแบบพิมพ์เอง');
        } else {
          setGpsError('การค้นหาพิกัด GPS ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (orderType === 'delivery') {
      if (!customerName.trim()) {
        setErrorMessage('กรุณาระบุชื่อผู้สั่งสำหรับจัดส่งอาหาร');
        return;
      }
      if (!phone || phone.trim().length < 9) {
        setErrorMessage('กรุณาระบุเบอร์โทรศัพท์อย่างน้อย 9 หลัก เพื่อใช้ติดต่อจัดส่ง');
        return;
      }
      if (!deliveryAddress.trim()) {
        setErrorMessage('กรุณาระบุที่อยู่จัดส่ง หรือจุดสังเกต');
        return;
      }
    } else {
      if (!phone || phone.trim().length < 9) {
        setErrorMessage('กรุณาระบุเบอร์โทรศัพท์อย่างน้อย 9 หลัก เพื่อใช้ติดต่อรับอาหาร');
        return;
      }
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
      type: orderType,
      customer_name: orderType === 'delivery' ? customerName.trim() : undefined,
      customer_phone: phone.trim(),
      delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
      delivery_lat: orderType === 'delivery' ? deliveryLat : undefined,
      delivery_lng: orderType === 'delivery' ? deliveryLng : undefined,
      pickup_at: orderType === 'takeaway' ? pickupDate.toISOString() : undefined,
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
          {/* Order Type Selector */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-3">
            <div className="text-stone-900 font-bold text-sm">เลือกรูปแบบการรับอาหาร</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderType('takeaway')}
                className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  orderType === 'takeaway'
                    ? 'border-amber-500 bg-amber-50/70 text-amber-900 shadow-xs ring-1 ring-amber-500'
                    : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    orderType === 'takeaway' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div className="font-bold text-xs">รับหน้าร้าน (Pick-up)</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">มารับที่ร้านด้วยตัวเอง</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  orderType === 'delivery'
                    ? 'border-purple-500 bg-purple-50/70 text-purple-900 shadow-xs ring-1 ring-purple-500'
                    : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    orderType === 'delivery' ? 'bg-purple-600 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  <Bike className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div className="font-bold text-xs">ให้ร้านไปส่ง (Delivery)</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">ร้านจัดส่งถึงที่</div>
                </div>
              </button>
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              {orderType === 'delivery' ? (
                <>
                  <Bike className="w-4 h-4 text-purple-600" />
                  <span>ข้อมูลผู้รับและที่อยู่จัดส่ง</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 text-amber-600" />
                  <span>ข้อมูลผู้สั่งอาหาร</span>
                </>
              )}
            </div>

            {/* If Delivery: Name Input */}
            {orderType === 'delivery' && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  ชื่อผู้สั่ง / ผู้รับอาหาร <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="เช่น คุณสมชาย หรือ แพนด้า"
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    maxLength={60}
                    required
                  />
                </div>
              </div>
            )}

            {/* Phone Input */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                {orderType === 'delivery'
                  ? 'เบอร์โทรศัพท์สำหรับติดต่อจัดส่ง'
                  : 'เบอร์โทรศัพท์สำหรับรับอาหาร'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="เช่น 0812345678"
                  className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 ${
                    orderType === 'delivery' ? 'focus:ring-purple-500' : 'focus:ring-amber-500'
                  }`}
                  maxLength={10}
                  required
                />
              </div>
            </div>

            {/* If Delivery: Address & GPS */}
            {orderType === 'delivery' ? (
              <div className="space-y-3 pt-1 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    ที่อยู่จัดส่งแบบพิมพ์เอง / จุดสังเกต <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="ระบุบ้านเลขที่, ซอย, ตึก, ชั้น หรือจุดสังเกต เช่น บ้านรั้วสีขาวตรงข้ามเซเว่น..."
                    className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                    maxLength={400}
                    required
                  />
                </div>

                {/* GPS Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-600">พิกัดแผนที่ (GPS)</span>
                    <span className="text-[11px] text-stone-400">ช่วยให้ไรเดอร์ไปส่งถึงที่ได้แม่นยำ</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGetGPS}
                    disabled={isGettingGps}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      gpsSuccess
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                    }`}
                  >
                    {isGettingGps ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span>กำลังค้นหาพิกัดดาวเทียม GPS...</span>
                      </>
                    ) : gpsSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>พิกัด GPS: {deliveryLat}, {deliveryLng} (บันทึกแล้ว ✓)</span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-4 h-4 text-purple-600" />
                        <span>📍 ดึงตำแหน่งปัจจุบัน (Get GPS)</span>
                      </>
                    )}
                  </button>

                  {gpsError && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      {gpsError}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Estimated Pickup Time (Takeaway only) */
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
            )}

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
                  <div className="font-bold text-xs">
                    {orderType === 'delivery' ? 'เงินสดปลายทาง (COD)' : 'เงินสดตอนรับที่ร้าน'}
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">
                    {orderType === 'delivery' ? 'จ่ายกับคนส่งเมื่อถึง' : 'จ่ายเมื่อมารับอาหาร'}
                  </div>
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
            className={`w-full py-4 px-6 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all text-base cursor-pointer ${
              orderType === 'delivery'
                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>กำลังส่งคำสั่งซื้อ...</span>
              </>
            ) : orderType === 'delivery' ? (
              <>
                <Bike className="w-5 h-5" />
                <span>สั่งให้ร้านไปส่ง ({finalTotal.toLocaleString('th-TH')} ฿)</span>
              </>
            ) : (
              <>
                <Store className="w-5 h-5" />
                <span>ยืนยันการสั่งอาหาร ({finalTotal.toLocaleString('th-TH')} ฿)</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
