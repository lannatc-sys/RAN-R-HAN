'use client';

import { useEffect, useState } from 'react';
import { Order, Shop, Payment } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle2,
  Clock,
  Flame,
  ShoppingBag,
  Store,
  Phone,
  QrCode,
  Copy,
  Check,
  Bike,
  MapPin,
  Utensils,
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HeaderControls } from '@/components/common/HeaderControls';

interface OrderTrackerClientProps {
  initialOrder: Order;
  shop: Shop;
  initialPayment: Payment | null;
  qrDataUrl: string | null;
}

export function OrderTrackerClient({
  initialOrder,
  shop,
  initialPayment,
  qrDataUrl,
}: OrderTrackerClientProps) {
  const { t, lang } = useLanguage();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [payment, setPayment] = useState<Payment | null>(initialPayment);
  const [copied, setCopied] = useState(false);

  // Subscribe to real-time updates for this order and payment
  useEffect(() => {
    const supabase = createClient();

    const orderChannel = supabase
      .channel(`order_${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          setOrder((prev) => ({ ...prev, ...(payload.new as Order) }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          setPayment(payload.new as Payment);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [order.id]);

  const isDelivery = order.type === 'delivery';
  const isDineIn = order.type === 'dine_in';

  const statusSteps = [
    { key: 'pending', label: t.tracker.pending, desc: t.tracker.pendingDesc, icon: Clock },
    { key: 'confirmed', label: t.tracker.confirmed, desc: t.tracker.confirmedDesc, icon: CheckCircle2 },
    { key: 'cooking', label: t.tracker.cooking, desc: t.tracker.cookingDesc, icon: Flame },
    {
      key: 'served',
      label: isDelivery ? t.tracker.servedDelivery : isDineIn ? t.tracker.servedDineIn : t.tracker.servedTakeaway,
      desc: isDelivery
        ? t.tracker.servedDeliveryDesc
        : isDineIn
        ? `${t.tracker.servedDineInDesc} (${t.common.table} ${order.table_no || ''})`
        : t.tracker.servedTakeawayDesc,
      icon: isDelivery ? Bike : isDineIn ? Utensils : ShoppingBag,
    },
    {
      key: 'completed',
      label: isDelivery ? t.tracker.completedDelivery : isDineIn ? t.tracker.completedDineIn : t.tracker.completedTakeaway,
      desc: t.tracker.completedDesc,
      icon: isDelivery ? Bike : isDineIn ? Utensils : Store,
    },
  ];

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status);
  const isPaid = payment?.status === 'verified';
  const isPromptPayPending = payment?.method === 'promptpay' && !isPaid;

  const handleCopyPromptPay = () => {
    if (shop.promptpay_id) {
      navigator.clipboard.writeText(shop.promptpay_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-stone-50 dark:bg-[#0c0a09] transition-colors">
      {/* Top Header */}
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200/70 dark:border-stone-800 sticky top-0 z-30 shadow-xs transition-colors">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href={`/${shop.slug}`}
              className="font-bold text-stone-900 dark:text-stone-100 hover:text-amber-700 text-xs sm:text-sm transition-colors flex items-center gap-1.5 truncate"
            >
              <Store className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">{shop.name}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] sm:text-xs text-stone-400 dark:text-stone-500">{t.common.queueNumber}</span>
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 leading-none">
                #{order.order_no}
              </div>
            </div>
            <HeaderControls />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-5 space-y-3.5 sm:space-y-4">
        {/* Status Callout Banner */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border shadow-xs text-center space-y-2 transition-colors ${
            order.status === 'served'
              ? isDelivery
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-200'
                : isDineIn
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
              : order.status === 'cooking'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
              : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 text-stone-900 dark:text-stone-100'
          }`}
        >
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {t.tracker.statusTitle}
          </div>
          <div className="text-xl sm:text-2xl font-black tracking-tight">
            {order.status === 'pending' && t.tracker.pending}
            {order.status === 'confirmed' && t.tracker.confirmed}
            {order.status === 'cooking' && t.tracker.cooking}
            {order.status === 'served' &&
              (isDelivery
                ? t.tracker.servedDelivery
                : isDineIn
                ? `${t.tracker.servedDineIn} ${order.table_no ? `(#${order.table_no})` : ''}`
                : t.tracker.servedTakeaway)}
            {order.status === 'completed' &&
              (isDelivery
                ? t.tracker.completedDelivery
                : isDineIn
                ? t.tracker.completedDineIn
                : t.tracker.completedTakeaway)}
            {order.status === 'cancelled' && t.tracker.cancelled}
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto leading-relaxed">
            {order.status === 'served'
              ? isDelivery
                ? t.tracker.servedDeliveryDesc
                : isDineIn
                ? `${t.tracker.servedDineInDesc} (${t.common.table} ${order.table_no || ''})`
                : `${t.tracker.servedTakeawayDesc} (#${order.order_no})`
              : order.status === 'cooking'
              ? t.tracker.cookingDesc
              : t.tracker.autoRefreshNotice}
          </p>
        </div>

        {/* Dine-in Info Card (if Dine-in Order) */}
        {isDineIn && (
          <div className="bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-4 rounded-3xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
              <span className="flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                {t.fulfillment.dineIn}
              </span>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-black shadow-xs">
                {t.common.table} #{order.table_no || '-'}
              </span>
            </div>
            {order.customer_name && (
              <div className="text-xs text-blue-950 dark:text-blue-300 font-medium">
                {lang === 'th' ? 'ชื่อผู้สั่ง:' : 'Customer:'} {order.customer_name}
              </div>
            )}
          </div>
        )}

        {/* Delivery Info Card (if Delivery Order) */}
        {isDelivery && (
          <div className="bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 p-4 rounded-3xl space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-200">
              <span className="flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                {t.fulfillment.delivery}
              </span>
              {order.customer_phone && (
                <a
                  href={`tel:${order.customer_phone}`}
                  className="text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{order.customer_phone}</span>
                </a>
              )}
            </div>
            {order.customer_name && (
              <div className="text-xs text-purple-950 dark:text-purple-300 font-semibold">
                {t.fulfillment.recipientName}: {order.customer_name}
              </div>
            )}
            {order.delivery_address && (
              <div className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300 bg-white/80 dark:bg-stone-800/80 p-3 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <span className="break-words leading-relaxed">{order.delivery_address}</span>
              </div>
            )}
          </div>
        )}

        {/* PromptPay QR Section (if PromptPay & Pending Payment) */}
        {isPromptPayPending && qrDataUrl && (
          <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-3xl border-2 border-amber-400 shadow-md space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-xs sm:text-sm">
              <QrCode className="w-5 h-5" />
              <span>{t.tracker.scanToPay}</span>
            </div>

            <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 bg-white p-2 rounded-2xl border border-stone-200 shadow-inner flex items-center justify-center">
              <img src={qrDataUrl} alt="PromptPay QR" className="w-full h-full object-contain" />
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-black text-stone-900 dark:text-stone-100">
                {Number(order.total).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400">{shop.promptpay_name || shop.name}</div>
            </div>

            {shop.promptpay_id && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl font-mono font-medium">
                  {shop.promptpay_id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPromptPay}
                  className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t.tracker.copied : t.tracker.copyPromptpay}</span>
                </button>
              </div>
            )}

            <div className="text-[11px] text-stone-400 dark:text-stone-500 bg-amber-50/70 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>{t.tracker.autoRefreshNotice}</span>
            </div>
          </div>
        )}

        {/* Payment Verified Badge */}
        {isPaid && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-2xl flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'th' ? 'ชำระเงินเรียบร้อยแล้ว (ตรวจสลิปอัตโนมัติ)' : 'Payment Verified Automatically'}</span>
          </div>
        )}

        {/* Cash payment notice */}
        {payment?.method === 'cash' && (
          <div className="bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-3.5 rounded-2xl text-center text-xs text-stone-700 dark:text-stone-300">
            {isDelivery
              ? lang === 'th' ? 'ชำระด้วยเงินสดปลายทางเมื่อได้รับอาหาร' : 'Pay cash on delivery upon arrival'
              : isDineIn
              ? lang === 'th' ? 'ชำระด้วยเงินสดที่โต๊ะเมื่อได้รับอาหาร' : 'Pay cash at your table'
              : lang === 'th' ? 'ชำระด้วยเงินสดตอนมารับอาหาร' : 'Pay cash at counter upon pick-up'}
            : <b> {Number(order.total).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}</b>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-4">
          <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
            {lang === 'th' ? 'ลำดับขั้นตอนการดำเนินงาน' : 'Order Timeline'}
          </div>

          <div className="space-y-4 relative before:absolute before:inset-y-3 before:left-4 before:w-0.5 before:bg-stone-100 dark:before:bg-stone-800">
            {statusSteps.map((step, idx) => {
              const isPassed = currentStepIndex >= idx && order.status !== 'cancelled';
              const isCurrent = order.status === step.key;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-3 sm:gap-4 relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors z-10 ${
                      isCurrent
                        ? 'bg-amber-600 text-white ring-4 ring-amber-100 dark:ring-amber-950'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="pt-1 flex-1 min-w-0">
                    <div
                      className={`text-xs font-bold truncate ${
                        isCurrent
                          ? 'text-amber-700 dark:text-amber-400'
                          : isPassed
                          ? 'text-stone-900 dark:text-stone-100'
                          : 'text-stone-400 dark:text-stone-500'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[11px] text-stone-400 dark:text-stone-500 leading-snug">
                      {step.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details Accordion / Summary */}
        <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-3 text-xs">
          <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
            {lang === 'th' ? 'รายละเอียดรายการอาหาร' : 'Order Details'}
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {order.order_items?.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                    {item.name_snapshot}
                  </span>
                  <span className="text-stone-400 dark:text-stone-500 ml-1.5">x{item.qty}</span>
                  {item.options_json && item.options_json.length > 0 && (
                    <div className="text-[11px] text-stone-400 dark:text-stone-500 truncate">
                      {item.options_json.map((o) => o.name).join(', ')}
                    </div>
                  )}
                  {item.note && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                      "{item.note}"
                    </div>
                  )}
                </div>
                <div className="font-semibold text-stone-900 dark:text-stone-100 shrink-0">
                  {(Number(item.price_snapshot) * item.qty).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-between font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
            <span>{t.common.total}</span>
            <span className="text-amber-700 dark:text-amber-400 text-sm sm:text-base">
              {Number(order.total).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}
            </span>
          </div>
        </div>

        {/* Back to Store Action */}
        <div className="pt-2 pb-safe">
          <Link
            href={`/${shop.slug}`}
            className="w-full py-3.5 px-6 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs sm:text-sm flex items-center justify-center transition-colors min-h-[44px]"
          >
            {t.tracker.orderAgain}
          </Link>
        </div>
      </main>
    </div>
  );
}
