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
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface OrderTrackerClientProps {
  initialOrder: Order;
  shop: Shop;
  initialPayment: Payment | null;
  qrDataUrl: string | null;
}

const STATUS_STEPS = [
  { key: 'pending', label: 'รอร้านรับออเดอร์', desc: 'ร้านค้ากำลังตรวจสอบรายการ', icon: Clock },
  { key: 'confirmed', label: 'ยืนยันออเดอร์แล้ว', desc: 'รับออเดอร์เข้าระบบเรียบร้อย', icon: CheckCircle2 },
  { key: 'cooking', label: 'กำลังปรุงอาหาร', desc: 'พ่อครัวกำลังเตรียมอาหารจานโปรด', icon: Flame },
  { key: 'served', label: 'พร้อมรับที่ร้าน', desc: 'อาหารเสร็จเรียบร้อย เชิญมารับที่หน้าร้านได้เลย', icon: ShoppingBag },
  { key: 'completed', label: 'รับอาหารเรียบร้อย', desc: 'ขอบคุณที่ใช้บริการ ขอให้อร่อยกับมื้อนี้ครับ', icon: Store },
];

export function OrderTrackerClient({
  initialOrder,
  shop,
  initialPayment,
  qrDataUrl,
}: OrderTrackerClientProps) {
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

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
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
    <div className="min-h-screen pb-20 bg-stone-50">
      {/* Top Header */}
      <header className="bg-white border-b border-stone-200/70 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${shop.slug}`}
              className="font-bold text-stone-900 hover:text-amber-700 text-sm transition-colors flex items-center gap-1.5"
            >
              <Store className="w-4 h-4 text-amber-600" />
              <span>{shop.name}</span>
            </Link>
          </div>
          <div className="text-right">
            <span className="text-xs text-stone-400">หมายเลขคิว</span>
            <div className="text-base font-black text-amber-700">#{order.order_no}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {/* Status Callout Banner */}
        <div
          className={`p-6 rounded-3xl border shadow-xs text-center space-y-2 ${
            order.status === 'served'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : order.status === 'cooking'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-white border-stone-200/80 text-stone-900'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            สถานะคำสั่งซื้อปัจจุบัน
          </div>
          <div className="text-2xl font-black tracking-tight">
            {order.status === 'pending' && 'กำลังรอร้านยืนยัน'}
            {order.status === 'confirmed' && 'ร้านยืนยันออเดอร์แล้ว'}
            {order.status === 'cooking' && '🔥 กำลังปรุงอาหารในครัว'}
            {order.status === 'served' && '🎉 อาหารพร้อมรับที่หน้าร้านแล้ว!'}
            {order.status === 'completed' && '✅ รับอาหารเรียบร้อยแล้ว'}
            {order.status === 'cancelled' && '❌ ออเดอร์นี้ถูกยกเลิก'}
          </div>
          <p className="text-xs text-stone-600 max-w-sm mx-auto">
            {order.status === 'served'
              ? 'กรุณาแจ้งหมายเลขคิว #' + order.order_no + ' ต่อพนักงานที่หน้าร้านเพื่อรับอาหาร'
              : order.status === 'cooking'
              ? 'ร้านกำลังปรุงอาหารสดใหม่ให้คุณ รอสักครู่เดียวครับ'
              : 'ระบบจะอัปเดตสถานะแบบเรียลไทม์อัตโนมัติ ไม่ต้องรีเฟรชหน้าจอ'}
          </p>
        </div>

        {/* PromptPay QR Section (if PromptPay & Pending Payment) */}
        {isPromptPayPending && qrDataUrl && (
          <div className="bg-white p-6 rounded-3xl border-2 border-amber-400 shadow-md space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm">
              <QrCode className="w-5 h-5" />
              <span>สแกน QR เพื่อชำระเงิน (พร้อมเพย์)</span>
            </div>

            <div className="relative mx-auto w-64 h-64 bg-white p-2 rounded-2xl border border-stone-200 shadow-inner flex items-center justify-center">
              <img src={qrDataUrl} alt="PromptPay QR" className="w-full h-full object-contain" />
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-black text-stone-900">
                {Number(order.total).toLocaleString('th-TH')} ฿
              </div>
              <div className="text-xs text-stone-500">{shop.promptpay_name || shop.name}</div>
            </div>

            {shop.promptpay_id && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-xs text-stone-600 bg-stone-100 px-3 py-1.5 rounded-xl font-mono font-medium">
                  {shop.promptpay_id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPromptPay}
                  className="p-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
            )}

            <div className="text-[11px] text-stone-400 bg-amber-50/70 p-3 rounded-2xl border border-amber-100 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>ระบบตรวจสอบสลิปอัตโนมัติ หลังโอนเสร็จสถานะจะอัปเดตทันที</span>
            </div>
          </div>
        )}

        {/* Payment Verified Badge */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-center gap-2 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ชำระเงินเรียบร้อยแล้ว (ตรวจสลิปอัตโนมัติ)</span>
          </div>
        )}

        {/* Cash payment notice */}
        {payment?.method === 'cash' && (
          <div className="bg-stone-100 border border-stone-200 p-3.5 rounded-2xl text-center text-xs text-stone-700">
            ชำระด้วยเงินสดตอนมารับอาหาร: <b>{Number(order.total).toLocaleString('th-TH')} ฿</b>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-4">
          <div className="text-sm font-bold text-stone-900">ลำดับขั้นตอน</div>

          <div className="space-y-4 relative before:absolute before:inset-y-3 before:left-4 before:w-0.5 before:bg-stone-100">
            {STATUS_STEPS.map((step, idx) => {
              const isPassed = currentStepIndex >= idx && order.status !== 'cancelled';
              const isCurrent = order.status === step.key;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors z-10 ${
                      isCurrent
                        ? 'bg-amber-600 text-white ring-4 ring-amber-100'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="pt-1 flex-1">
                    <div
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-amber-700'
                          : isPassed
                          ? 'text-stone-900'
                          : 'text-stone-400'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[11px] text-stone-400">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details Accordion / Summary */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/70 shadow-xs space-y-3 text-xs">
          <div className="font-bold text-stone-900 text-sm">รายละเอียดรายการอาหาร</div>

          <div className="divide-y divide-stone-100">
            {order.order_items?.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-stone-800">{item.name_snapshot}</span>
                  <span className="text-stone-400 ml-1.5">x{item.qty}</span>
                  {item.options_json && item.options_json.length > 0 && (
                    <div className="text-[11px] text-stone-400">
                      {item.options_json.map((o) => o.name).join(', ')}
                    </div>
                  )}
                  {item.note && (
                    <div className="text-[11px] text-amber-700 italic">"{item.note}"</div>
                  )}
                </div>
                <div className="font-semibold text-stone-900">
                  {(Number(item.price_snapshot) * item.qty).toLocaleString('th-TH')} ฿
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-between font-bold text-sm text-stone-900">
            <span>ยอดรวมทั้งสิ้น</span>
            <span className="text-amber-700">{Number(order.total).toLocaleString('th-TH')} ฿</span>
          </div>
        </div>
      </main>
    </div>
  );
}
