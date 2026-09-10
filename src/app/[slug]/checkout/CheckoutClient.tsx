'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shop, CartItem, OrderType } from '@/lib/types';
import { createPickupOrderAction } from '@/app/actions/order';
import { createConsentLogAction } from '@/app/actions/legal';
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
  LocateFixed,
  Check,
  User,
  Utensils,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { getActiveFulfillmentModes } from '@/lib/plans';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HeaderControls } from '@/components/common/HeaderControls';

interface CheckoutClientProps {
  shop: Shop;
}

export function CheckoutClient({ shop }: CheckoutClientProps) {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const availableModes = getActiveFulfillmentModes(shop);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(() => {
    const modes = getActiveFulfillmentModes(shop);
    return modes.length > 0 ? modes[0] : 'takeaway';
  });
  const [tableNo, setTableNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [gpsConsentTime, setGpsConsentTime] = useState<string | null>(null);
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
      setGpsError(t.fulfillment.gpsError);
      return;
    }

    setIsGettingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryLat(Number(position.coords.latitude.toFixed(6)));
        setDeliveryLng(Number(position.coords.longitude.toFixed(6)));
        setGpsSuccess(true);
        setGpsConsentTime(new Date().toISOString());
        setIsGettingGps(false);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setIsGettingGps(false);
        setGpsError(t.fulfillment.gpsError);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isLoading) return;

    // ตรวจสอบความครบถ้วนของข้อมูล
    if (orderType === 'dine_in' && !tableNo.trim()) {
      setErrorMessage(t.checkout.fillTableWarning);
      return;
    }

    if (orderType === 'delivery') {
      if (!customerName.trim() || !phone.trim() || !deliveryAddress.trim()) {
        setErrorMessage(t.checkout.fillDeliveryWarning);
        return;
      }
    } else if (orderType === 'takeaway' && !phone.trim()) {
      setErrorMessage(lang === 'th' ? 'กรุณากรอกเบอร์โทรศัพท์สำหรับรับอาหาร' : 'Please provide a contact phone number.');
      return;
    }

    // ตรวจสอบการยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัว (WP-20)
    if (!isTermsAccepted) {
      setErrorMessage(
        lang === 'th'
          ? 'กรุณาทำเครื่องหมายยินยอมข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวก่อนสั่งซื้อ'
          : 'Please accept the Terms of Service and Privacy Policy before placing order.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const pickupDate = new Date(Date.now() + pickupMinutes * 60 * 1000);
      const result = await createPickupOrderAction({
        shop_id: shop.id,
        customer_phone: phone.trim() || (orderType === 'dine_in' ? '0000000000' : ''),
        type: orderType,
        table_no: orderType === 'dine_in' ? tableNo.trim() : null,
        customer_name: customerName.trim() || null,
        delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : null,
        delivery_lat: orderType === 'delivery' ? deliveryLat : null,
        delivery_lng: orderType === 'delivery' ? deliveryLng : null,
        pickup_at: orderType === 'takeaway' ? pickupDate.toISOString() : null,
        note: note.trim() || undefined,
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          menu_item_id: item.menu_item_id,
          qty: item.qty,
          option_ids: item.selected_options.map((o) => o.id),
          note: item.note,
        })),
      });

      if (!result.success || !result.data) {
        setErrorMessage(result.error || (lang === 'th' ? 'เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ' : 'Failed to place order'));
        setIsLoading(false);
        return;
      }

      // บันทึกหลักฐานการให้ความยินยอม (Consent Evidence - WP-20)
      const orderId = result.data.order_id;
      const clientPhone = phone.trim() || undefined;

      // 1. ความยินยอมข้อกำหนดและนโยบายความเป็นส่วนตัว
      createConsentLogAction({
        shop_id: shop.id,
        order_id: orderId,
        customer_phone: clientPhone,
        consent_type: 'terms_and_privacy',
        policy_version: '2026-09-10',
      }).catch(err => console.error('[Consent Log Error]:', err));

      // 2. ความยินยอมแชร์พิกัด GPS (หากมีการระบุพิกัด)
      if (deliveryLat && deliveryLng) {
        createConsentLogAction({
          shop_id: shop.id,
          order_id: orderId,
          customer_phone: clientPhone,
          consent_type: 'gps_location',
          policy_version: '2026-09-10',
        }).catch(err => console.error('[GPS Consent Log Error]:', err));
      }

      // ล้างตะกร้าสินค้าใน localStorage
      localStorage.removeItem(`cart_${shop.id}`);

      // ไปยังหน้าติดตามออเดอร์
      router.push(`/order/${result.data.order_id}`);
    } catch (err: any) {
      setErrorMessage(err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง' : 'Failed to place order. Please try again.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-stone-50 dark:bg-[#0c0a09] transition-colors">
      {/* Top Header */}
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200/70 dark:border-stone-800 sticky top-0 z-30 shadow-xs transition-colors">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href={`/${shop.slug}`}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors shrink-0"
              aria-label={t.common.back}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base leading-tight truncate">
                {t.checkout.title}
              </h1>
              <div className="text-[11px] sm:text-xs text-stone-400 dark:text-stone-500 truncate">
                {shop.name}
              </div>
            </div>
          </div>

          <HeaderControls />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-5">
        <form onSubmit={handleSubmitOrder} className="space-y-4 sm:space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-xs sm:text-sm text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Fulfillment Mode Selector */}
          {availableModes.length > 1 ? (
            <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm">
                  {t.fulfillment.title}
                </span>
                <span className="text-[11px] text-stone-400 dark:text-stone-500">
                  {availableModes.length} {lang === 'th' ? 'ตัวเลือก' : 'options'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {availableModes.includes('dine_in') && (
                  <button
                    type="button"
                    onClick={() => setOrderType('dine_in')}
                    className={`p-3 rounded-2xl border flex items-center sm:flex-col sm:items-center gap-2.5 sm:gap-1.5 transition-all cursor-pointer min-h-[48px] ${
                      orderType === 'dine_in'
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs ring-1 ring-blue-500'
                        : 'border-stone-200 dark:border-stone-700/80 hover:border-stone-300 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        orderType === 'dine_in'
                          ? 'bg-blue-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <Utensils className="w-4 h-4" />
                    </div>
                    <div className="text-left sm:text-center min-w-0">
                      <div className="font-bold text-xs">{t.fulfillment.dineIn}</div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-400 truncate">
                        {lang === 'th' ? 'ระบุเลขโต๊ะ' : 'Specify Table'}
                      </div>
                    </div>
                  </button>
                )}

                {availableModes.includes('takeaway') && (
                  <button
                    type="button"
                    onClick={() => setOrderType('takeaway')}
                    className={`p-3 rounded-2xl border flex items-center sm:flex-col sm:items-center gap-2.5 sm:gap-1.5 transition-all cursor-pointer min-h-[48px] ${
                      orderType === 'takeaway'
                        ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-xs ring-1 ring-amber-500'
                        : 'border-stone-200 dark:border-stone-700/80 hover:border-stone-300 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        orderType === 'takeaway'
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="text-left sm:text-center min-w-0">
                      <div className="font-bold text-xs">{t.fulfillment.takeaway}</div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-400 truncate">
                        {lang === 'th' ? 'สั่งล่วงหน้ารับเอง' : 'Pick-up'}
                      </div>
                    </div>
                  </button>
                )}

                {availableModes.includes('delivery') && (
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={`p-3 rounded-2xl border flex items-center sm:flex-col sm:items-center gap-2.5 sm:gap-1.5 transition-all cursor-pointer min-h-[48px] ${
                      orderType === 'delivery'
                        ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-xs ring-1 ring-purple-500'
                        : 'border-stone-200 dark:border-stone-700/80 hover:border-stone-300 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        orderType === 'delivery'
                          ? 'bg-purple-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <Bike className="w-4 h-4" />
                    </div>
                    <div className="text-left sm:text-center min-w-0">
                      <div className="font-bold text-xs">{t.fulfillment.delivery}</div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-400 truncate">
                        {lang === 'th' ? 'ร้านจัดส่งถึงที่' : 'Store Delivery'}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200">
                {orderType === 'dine_in' && <Utensils className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                {orderType === 'takeaway' && <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                {orderType === 'delivery' && <Bike className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                <span>
                  {orderType === 'dine_in'
                    ? t.fulfillment.dineIn
                    : orderType === 'delivery'
                    ? t.fulfillment.delivery
                    : t.fulfillment.takeaway}
                </span>
              </div>
              <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2.5 py-0.5 rounded-full font-semibold">
                {lang === 'th' ? 'ช่องทางเดียวที่เปิดบริการ' : 'Only Available Channel'}
              </span>
            </div>
          )}

          {/* Customer Info Card */}
          <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm">
              {orderType === 'delivery' ? (
                <>
                  <Bike className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{lang === 'th' ? 'ข้อมูลผู้รับและที่อยู่จัดส่ง' : 'Recipient & Delivery Details'}</span>
                </>
              ) : orderType === 'dine_in' ? (
                <>
                  <Utensils className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{lang === 'th' ? 'ข้อมูลโต๊ะอาหารสำหรับทานที่ร้าน' : 'Table Information (Dine-in)'}</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{lang === 'th' ? 'ข้อมูลผู้สั่งอาหาร (รับหน้าร้าน)' : 'Customer Contact Information'}</span>
                </>
              )}
            </div>

            {/* If Dine-in: Table Number */}
            {orderType === 'dine_in' && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                  {t.fulfillment.tableNumberLabel} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Utensils className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableNo}
                    onChange={(e) => setTableNo(e.target.value)}
                    placeholder={t.fulfillment.tableNumberPlaceholder}
                    className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    maxLength={30}
                    required
                  />
                </div>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                  {t.fulfillment.tableNumberHelp}
                </p>
              </div>
            )}

            {/* If Delivery: Name Input */}
            {orderType === 'delivery' && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                  {t.fulfillment.recipientName} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t.fulfillment.recipientNamePlaceholder}
                    className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    maxLength={60}
                    required
                  />
                </div>
              </div>
            )}

            {/* Phone Input */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                {orderType === 'delivery'
                  ? t.fulfillment.phoneNumber
                  : orderType === 'dine_in'
                  ? `${t.fulfillment.phoneNumber} (${t.common.optional})`
                  : t.fulfillment.phoneNumber}{' '}
                {orderType !== 'dine_in' && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={t.fulfillment.phoneNumberPlaceholder}
                  className={`w-full pl-10 pr-4 py-3 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 ${
                    orderType === 'delivery'
                      ? 'focus:ring-purple-500'
                      : orderType === 'dine_in'
                      ? 'focus:ring-blue-500'
                      : 'focus:ring-amber-500'
                  }`}
                  maxLength={10}
                  required={orderType !== 'dine_in'}
                />
              </div>
            </div>

            {/* If Delivery: Address & GPS */}
            {orderType === 'delivery' && (
              <div className="space-y-3 pt-1 border-t border-stone-100 dark:border-stone-800">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                    {t.fulfillment.deliveryAddress} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={t.fulfillment.deliveryAddressPlaceholder}
                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                    maxLength={400}
                    required
                  />
                </div>

                {/* GPS Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                      {lang === 'th' ? 'พิกัดแผนที่ (GPS)' : 'GPS Coordinates'}
                    </span>
                    <span className="text-[11px] text-stone-400 dark:text-stone-500">
                      {lang === 'th' ? 'ช่วยให้ไรเดอร์ไปส่งถึงที่ได้แม่นยำ' : 'Helps rider navigate accurately'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGetGPS}
                    disabled={isGettingGps}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                      gpsSuccess
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {isGettingGps ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span>{t.fulfillment.gettingGps}</span>
                      </>
                    ) : gpsSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>
                          {t.fulfillment.gpsSuccess}: {deliveryLat}, {deliveryLng} ✓
                        </span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-4 h-4 text-purple-600" />
                        <span>{t.fulfillment.getGps}</span>
                      </>
                    )}
                  </button>

                  {gpsError && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                      {gpsError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Estimated Pickup Time (Takeaway only) */}
            {orderType === 'takeaway' && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                  {t.fulfillment.pickupTimeLabel}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[15, 30, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setPickupMinutes(mins)}
                      className={`py-2.5 px-2.5 sm:px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1 sm:gap-1.5 transition-all min-h-[44px] cursor-pointer ${
                        pickupMinutes === mins
                          ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                          : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{mins} {lang === 'th' ? 'นาที' : 'mins'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note to Kitchen */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                {t.checkout.notesTitle}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.checkout.notesPlaceholder}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                maxLength={200}
              />
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-3 sm:space-y-4">
            <div className="text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm">
              {t.checkout.paymentMethod}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <label
                onClick={() => setPaymentMethod('promptpay')}
                className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer flex sm:flex-col items-center gap-3 sm:gap-2 sm:text-center transition-all min-h-[48px] ${
                  paymentMethod === 'promptpay'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-stone-900 dark:text-stone-100 ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700/80 hover:border-stone-300 text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-800'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    paymentMethod === 'promptpay'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left sm:text-center min-w-0">
                  <div className="font-bold text-xs">
                    {lang === 'th' ? 'โอนพร้อมเพย์' : 'PromptPay QR'}
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                    {lang === 'th' ? 'ตรวจสลิปอัตโนมัติ' : 'Instant Verification'}
                  </div>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('cash')}
                className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer flex sm:flex-col items-center gap-3 sm:gap-2 sm:text-center transition-all min-h-[48px] ${
                  paymentMethod === 'cash'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-stone-900 dark:text-stone-100 ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700/80 hover:border-stone-300 text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-800'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    paymentMethod === 'cash'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="text-left sm:text-center min-w-0">
                  <div className="font-bold text-xs">
                    {orderType === 'delivery'
                      ? lang === 'th' ? 'เงินสดปลายทาง (COD)' : 'Cash on Delivery'
                      : orderType === 'dine_in'
                      ? lang === 'th' ? 'เงินสดที่โต๊ะ' : 'Cash at Table'
                      : lang === 'th' ? 'เงินสดตอนรับที่ร้าน' : 'Cash at Counter'}
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                    {orderType === 'delivery'
                      ? t.checkout.cashDeliveryDesc
                      : orderType === 'dine_in'
                      ? t.checkout.cashDineInDesc
                      : t.checkout.cashTakeawayDesc}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Order Summary Card */}
          <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-3">
            <div className="text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm">
              {t.checkout.orderSummary} ({cart.length} {t.common.items})
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-56 overflow-y-auto">
              {cart.map((item, idx) => (
                <div key={idx} className="py-2 sm:py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                      {item.name}
                    </span>
                    <span className="text-stone-400 dark:text-stone-500 ml-1.5">x{item.qty}</span>
                    {item.selected_options.length > 0 && (
                      <div className="text-[11px] text-stone-400 dark:text-stone-500 truncate">
                        {item.selected_options.map((o) => o.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-stone-900 dark:text-stone-100 shrink-0">
                    {item.line_total.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
              <div className="flex justify-between">
                <span>{t.common.subtotal}</span>
                <span>{subtotal.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}</span>
              </div>
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>
                    {lang === 'th' ? 'ค่าบริการ' : 'Service Charge'} ({shop.service_charge}%)
                  </span>
                  <span>{serviceChargeAmount.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}</span>
                </div>
              )}
              {vatAmount > 0 && (
                <div className="flex justify-between">
                  <span>{lang === 'th' ? 'ภาษีมูลค่าเพิ่ม' : 'VAT'} (7%)</span>
                  <span>{vatAmount.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 pt-2 border-t border-stone-100 dark:border-stone-800">
                <span>{t.common.total}</span>
                <span className="text-sm sm:text-base text-amber-700 dark:text-amber-400">
                  {finalTotal.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
                </span>
              </div>
            </div>
          </div>

          {/* PDPA & Terms Consent Checkbox (WP-20) */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer text-xs text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                required
                checked={isTermsAccepted}
                onChange={(e) => setIsTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
              />
              <span className="leading-relaxed">
                ข้าพเจ้าได้อ่านและยอมรับ{' '}
                <Link
                  href={`/${shop.slug}/terms`}
                  target="_blank"
                  className="font-bold underline text-amber-700 dark:text-amber-400 hover:text-amber-800"
                >
                  ข้อกำหนดการใช้งาน
                </Link>{' '}
                และ{' '}
                <Link
                  href={`/${shop.slug}/privacy`}
                  target="_blank"
                  className="font-bold underline text-amber-700 dark:text-amber-400 hover:text-amber-800"
                >
                  นโยบายความเป็นส่วนตัว (PDPA)
                </Link>{' '}
                และยินยอมให้ประมวลผลข้อมูลส่วนบุคคลเพื่อการจัดเตรียมอาหารและการติดต่อจัดส่ง *
              </span>
            </label>
          </div>

          {/* Submit Button with Safe Area */}
          <div className="pb-safe pt-1">
            <button
              type="submit"
              disabled={isLoading || cart.length === 0 || !isTermsAccepted}
              className={`w-full py-3.5 sm:py-4 px-6 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all text-sm sm:text-base cursor-pointer min-h-[48px] ${
                orderType === 'delivery'
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30'
                  : orderType === 'dine_in'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.checkout.submitting}</span>
                </>
              ) : orderType === 'delivery' ? (
                <>
                  <Bike className="w-5 h-5" />
                  <span>
                    {t.checkout.submitDelivery} ({finalTotal.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency})
                  </span>
                </>
              ) : orderType === 'dine_in' ? (
                <>
                  <Utensils className="w-5 h-5" />
                  <span>
                    {t.checkout.submitDineIn} {tableNo ? `(#${tableNo})` : ''} ({finalTotal.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency})
                  </span>
                </>
              ) : (
                <>
                  <Store className="w-5 h-5" />
                  <span>
                    {t.checkout.submitTakeaway} ({finalTotal.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
