'use client';

import { useEffect, useState, useRef } from 'react';
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
  Send,
  ExternalLink,
  Loader2,
  Upload,
  AlertCircle,
  X,
  ShieldCheck,
  ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HeaderControls } from '@/components/common/HeaderControls';
import { createTelegramLinkAction } from '@/app/actions/telegram';
import { uploadAndVerifySlipAction } from '@/app/actions/payment';

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
  const [isConnectingTelegram, setIsConnectingTelegram] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramOpened, setTelegramOpened] = useState(false);

  // Slip Upload & Verification State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [slipSuccess, setSlipSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSlipError(lang === 'th' ? 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP)' : 'Please select an image file (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSlipError(lang === 'th' ? 'ขนาดไฟล์รูปภาพต้องไม่เกิน 10MB' : 'File size must not exceed 10MB');
      return;
    }

    setSlipFile(file);
    setSlipPreviewUrl(URL.createObjectURL(file));
    setSlipError(null);
    setSlipSuccess(null);
  };

  const handleClearFile = () => {
    setSlipFile(null);
    if (slipPreviewUrl) {
      URL.revokeObjectURL(slipPreviewUrl);
      setSlipPreviewUrl(null);
    }
    setSlipError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVerifySlip = async () => {
    if (!slipFile) {
      setSlipError(lang === 'th' ? 'กรุณาเลือกไฟล์รูปภาพสลิป' : 'Please select a slip image');
      return;
    }

    setIsVerifyingSlip(true);
    setSlipError(null);
    setSlipSuccess(null);

    try {
      const formData = new FormData();
      formData.append('order_id', order.id);
      formData.append('slip', slipFile);

      const res = await uploadAndVerifySlipAction(formData);

      if (res.success) {
        setSlipSuccess(res.message || (lang === 'th' ? 'ตรวจสอบสลิปสำเร็จ!' : 'Slip verified successfully!'));
        setPayment((prev) => (prev ? { ...prev, status: 'verified' } : null));
        setOrder((prev) => ({ ...prev, status: 'confirmed' }));
      } else {
        setSlipError(res.error || (lang === 'th' ? 'ตรวจสอบสลิปไม่สำเร็จ' : 'Verification failed'));
      }
    } catch (err: any) {
      setSlipError(err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' : 'An error occurred'));
    } finally {
      setIsVerifyingSlip(false);
    }
  };

  const handleConnectTelegram = async () => {
    setIsConnectingTelegram(true);
    setTelegramError(null);
    try {
      const res = await createTelegramLinkAction(order.id);
      if (res.success && res.botUrl) {
        setTelegramOpened(true);
        window.open(res.botUrl, '_blank');
      } else {
        setTelegramError(res.error || 'ไม่สามารถสร้างลิงก์ Telegram ได้');
      }
    } catch (err: any) {
      setTelegramError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsConnectingTelegram(false);
    }
  };

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

            {/* Divider: แนบสลิปเพื่อตรวจสอบ */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-amber-200 dark:border-stone-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-stone-900 px-3 text-stone-400 dark:text-stone-500 font-medium text-[11px]">
                  {lang === 'th' ? 'โอนเงินแล้ว? แนบสลิปเพื่อยืนยันทันที' : 'Paid? Upload slip for instant verification'}
                </span>
              </div>
            </div>

            {/* กล่องแนบสลิป SlipOK */}
            <div className="bg-stone-50/80 dark:bg-stone-800/60 p-4 rounded-2xl border border-stone-200 dark:border-stone-700/80 space-y-3 text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {t.tracker.uploadSlipTitle}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
                    {t.tracker.uploadSlipDesc}
                  </div>
                </div>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Upload Drop Area / Preview */}
              {!slipPreviewUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 px-3 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all flex flex-col items-center justify-center gap-1.5 text-stone-600 dark:text-stone-300 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-700 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 flex items-center justify-center transition-colors">
                    <Upload className="w-4 h-4 text-stone-500 dark:text-stone-400 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    {t.tracker.selectSlipFile}
                  </span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    JPG, PNG หรือภาพถ่ายจากมือถือ (สูงสุด 10MB)
                  </span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="relative w-full max-h-52 bg-stone-100 dark:bg-stone-900 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 flex items-center justify-center p-2">
                    <img
                      src={slipPreviewUrl}
                      alt="Slip Preview"
                      className="max-h-44 object-contain rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleClearFile}
                      disabled={isVerifyingSlip}
                      className="absolute top-2.5 right-2.5 p-1 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white transition-colors cursor-pointer"
                      title={t.tracker.changeSlipFile}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isVerifyingSlip}
                      className="flex-1 py-2 px-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {t.tracker.changeSlipFile}
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifySlip}
                      disabled={isVerifyingSlip}
                      className="flex-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isVerifyingSlip ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t.tracker.verifyingSlip}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t.tracker.verifySlipButton}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {slipError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span className="leading-relaxed">{slipError}</span>
                </div>
              )}

              {/* Success Message */}
              {slipSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{slipSuccess}</span>
                </div>
              )}
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

        {/* Telegram Customer Notification Card */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          order.telegram_chat_id ? (
            <div className="bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 p-4 rounded-3xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-sky-950 dark:text-sky-200 truncate">
                    {lang === 'th' ? 'เชื่อมต่อ Telegram เรียบร้อยแล้ว ✅' : 'Connected to Telegram ✅'}
                  </div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-400 truncate">
                    {lang === 'th' ? 'ระบบจะส่งข้อความแจ้งเตือนหาคุณทันทีเมื่ออาหารพร้อม' : 'You will receive an alert when ready'}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 shrink-0">
                @ranrhan_bot
              </span>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 dark:from-sky-950/40 dark:to-blue-950/30 border border-sky-200/80 dark:border-sky-800/60 p-4 sm:p-5 rounded-3xl space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                      {lang === 'th' ? 'รับแจ้งเตือนผ่าน Telegram (ฟรี)' : 'Get Telegram Alerts (Free)'}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {lang === 'th' ? 'ไม่ต้องเปิดหน้านี้ค้างไว้ รับแจ้งเตือนเมื่ออาหารพร้อมเสิร์ฟ' : 'No need to keep tab open. Get alert when ready.'}
                    </p>
                  </div>
                </div>
              </div>

              {telegramError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-xl border border-red-200 dark:border-red-800">
                  {telegramError}
                </div>
              )}

              {telegramOpened ? (
                <div className="bg-white/80 dark:bg-stone-900/80 p-3 rounded-2xl border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                    <span>{lang === 'th' ? 'เปิดแอป Telegram แล้วหรือยัง?' : 'Opened Telegram?'}</span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400">
                    {lang === 'th' ? 'กรุณากดปุ่ม "Start" ในแอป Telegram 1 ครั้ง เพื่อเปิดรับการแจ้งเตือนคิวนี้ค่ะ' : 'Please tap "Start" in Telegram to subscribe to this order.'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectTelegram}
                  disabled={isConnectingTelegram}
                  className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isConnectingTelegram ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{lang === 'th' ? 'เชื่อมต่อ Telegram (@ranrhan_bot)' : 'Connect Telegram (@ranrhan_bot)'}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              )}
            </div>
          )
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
