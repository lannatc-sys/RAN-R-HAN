'use client';

import { useState, useEffect } from 'react';
import { Order, Shop, Payment } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { updateOrderStatusAction, confirmCashPaymentAction } from '@/app/actions/order';
import {
  Clock,
  CheckCircle2,
  Flame,
  ShoppingBag,
  Store,
  Phone,
  Banknote,
  CreditCard,
  Check,
  RotateCcw,
  Loader2,
  UserCheck,
  Globe,
  ChefHat,
  XCircle,
  Bike,
  MapPin,
  ExternalLink,
  Utensils,
} from 'lucide-react';
import { PinModal } from '@/components/admin/PinModal';

interface OrdersKDSClientProps {
  initialOrders: Order[];
  shop: Shop;
  isPrivacyMode?: boolean;
}

export function OrdersKDSClient({ initialOrders, shop, isPrivacyMode = false }: OrdersKDSClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<'active' | 'served' | 'completed' | 'all'>('active');
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);

  // Subscribe to Supabase Realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('kds_orders_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `shop_id=eq.${shop.id}`,
        },
        async () => {
          // โหลดข้อมูลออเดอร์ล่าสุดทั้งหมดเมื่อมีการเปลี่ยนแปลง
          const { data: updated } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (*),
              payments (*)
            `)
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false });

          if (updated) {
            setOrders(updated as Order[]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop.id]);

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: 'confirmed' | 'cooking' | 'served' | 'completed' | 'cancelled'
  ) => {
    setLoadingOrderId(orderId);
    await updateOrderStatusAction(orderId, newStatus);
    // อัปเดต state ทันทีใน frontend เพื่อความลื่นไหล
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    setLoadingOrderId(null);
  };

  const handleConfirmCash = async (orderId: string) => {
    setLoadingOrderId(orderId);
    await confirmCashPaymentAction(orderId);
    // อัปเดต state payment
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const updatedPayments = (o.payments || []).map((p) =>
          p.method === 'cash' ? { ...p, status: 'verified' as const } : p
        );
        return {
          ...o,
          status: o.status === 'pending' ? 'confirmed' : o.status,
          payments: updatedPayments,
        };
      })
    );
    setLoadingOrderId(null);
  };

  // Filter orders based on active tab
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'active') {
      return ['pending', 'confirmed', 'cooking'].includes(o.status);
    }
    if (activeTab === 'served') {
      return o.status === 'served';
    }
    if (activeTab === 'completed') {
      return ['completed', 'cancelled'].includes(o.status);
    }
    return true;
  });

  const activeCount = orders.filter((o) => ['pending', 'confirmed', 'cooking'].includes(o.status)).length;
  const servedCount = orders.filter((o) => o.status === 'served').length;

  return (
    <div className="space-y-4">
      {/* Privacy Mode Notice */}
      {isPrivacyMode && (
        <div className="p-3 bg-slate-900 text-amber-300 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-xs">
          <span className="text-base">🔒</span>
          <span>
            โหมดความเป็นส่วนตัว Superadmin: ข้อมูลทางการเงินทั้งหมดถูกเซ็นเซอร์เป็น *** ฿ (ร้านค้ายังไม่ได้เปิดความยินยอม Support Access)
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'active'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white hover:bg-stone-50 text-stone-600 border border-stone-200'
            }`}
          >
            <span>กำลังทำ / รอรับ</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'active' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('served')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'served'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white hover:bg-stone-50 text-stone-600 border border-stone-200'
            }`}
          >
            <span>พร้อมรับที่ร้าน</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'served' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {servedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'completed'
                ? 'bg-stone-800 text-white shadow-sm'
                : 'bg-white hover:bg-stone-50 text-stone-600 border border-stone-200'
            }`}
          >
            ประวัติเสร็จสิ้น
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-stone-800 text-white shadow-sm'
                : 'bg-white hover:bg-stone-50 text-stone-600 border border-stone-200'
            }`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-stone-200/70 p-8 space-y-3">
          <ChefHat className="w-12 h-12 text-stone-300 mx-auto stroke-1" />
          <div className="font-bold text-stone-700 text-base">ไม่มีออเดอร์ในหมวดหมู่นี้</div>
          <div className="text-xs text-stone-400">
            ออเดอร์ใหม่จากลูกค้าจะปรากฏขึ้นที่นี่โดยอัตโนมัติแบบเรียลไทม์
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const payment = order.payments && order.payments.length > 0 ? order.payments[0] : null;
            const isCash = payment?.method === 'cash';
            const isPaid = payment?.status === 'verified';
            const isActing = loadingOrderId === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  order.type === 'delivery'
                    ? 'border-purple-300 ring-2 ring-purple-100'
                    : order.type === 'dine_in'
                    ? 'border-blue-300 ring-2 ring-blue-100'
                    : order.status === 'served'
                    ? 'border-emerald-300 ring-2 ring-emerald-100'
                    : order.status === 'cooking'
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-stone-200/80 hover:border-amber-200'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-stone-900">
                        #{order.order_no}
                      </span>
                      {order.type === 'delivery' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                          <Bike className="w-3 h-3" />
                          ร้านจัดส่ง
                        </span>
                      ) : order.type === 'dine_in' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                          <Utensils className="w-3 h-3" />
                          โต๊ะ {order.table_no || '-'}
                        </span>
                      ) : order.source === 'staff' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          หน้าร้าน
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          สั่งล่วงหน้า (รับเอง)
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {order.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-100 text-stone-700">
                          รอรับออเดอร์
                        </span>
                      )}
                      {order.status === 'confirmed' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800">
                          รับแล้ว
                        </span>
                      )}
                      {order.status === 'cooking' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500 text-white flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          กำลังทำ
                        </span>
                      )}
                      {order.status === 'served' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {order.type === 'delivery' ? 'พร้อมส่ง' : order.type === 'dine_in' ? 'พร้อมเสิร์ฟ' : 'พร้อมรับ'}
                        </span>
                      )}
                      {order.status === 'completed' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-200 text-stone-600">
                          เสร็จสิ้น
                        </span>
                      )}
                      {order.status === 'cancelled' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-red-100 text-red-700">
                          ยกเลิก
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer and Time */}
                  <div className="flex items-center justify-between text-xs text-stone-500 pt-2 pb-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>
                        {new Date(order.created_at).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {order.customer_name && (
                        <span className="font-bold text-stone-800 ml-1">
                          • คุณ{order.customer_name}
                        </span>
                      )}
                    </div>

                    {order.customer_phone ? (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="flex items-center gap-1 font-semibold text-amber-700 hover:underline shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{order.customer_phone}</span>
                      </a>
                    ) : (
                      <span className="text-stone-400 shrink-0">ไม่ระบุเบอร์</span>
                    )}
                  </div>

                  {/* Delivery Info Box (for Delivery orders) */}
                  {order.type === 'delivery' && (
                    <div className="mb-3 p-3 rounded-2xl bg-purple-50/80 border border-purple-200 text-xs space-y-2">
                      <div className="flex items-center justify-between font-bold text-purple-900">
                        <span className="flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-purple-700" />
                          ส่งโดยร้าน (Delivery)
                        </span>
                        {order.customer_name && (
                          <span className="text-purple-800 font-semibold">ผู้รับ: {order.customer_name}</span>
                        )}
                      </div>

                      {order.delivery_address && (
                        <div className="flex items-start gap-1.5 text-stone-700 font-medium">
                          <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          <span className="break-words leading-relaxed">{order.delivery_address}</span>
                        </div>
                      )}

                      {order.delivery_lat && order.delivery_lng && (
                        <a
                          href={`https://maps.google.com/?q=${order.delivery_lat},${order.delivery_lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all w-full justify-center mt-1"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>เปิดแผนที่ Google Maps</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Dine-in Info Box (for Dine-in orders) */}
                  {order.type === 'dine_in' && (
                    <div className="mb-3 p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-blue-900">
                        <span className="flex items-center gap-1.5">
                          <Utensils className="w-4 h-4 text-blue-700" />
                          ทานที่ร้าน (Dine-in)
                        </span>
                        <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-lg text-xs font-black">
                          โต๊ะ {order.table_no || 'ไม่ระบุ'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {order.note && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-900 font-medium">
                      โน้ต: {order.note}
                    </div>
                  )}

                  {/* Order Items List */}
                  <div className="space-y-2 py-1 divide-y divide-stone-100 text-xs">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="pt-2 first:pt-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-stone-900 text-sm">
                              {item.qty}x
                            </span>{' '}
                            <span className="font-semibold text-stone-800">
                              {item.name_snapshot}
                            </span>
                          </div>
                          <span className="text-stone-400">
                            {isPrivacyMode ? '*** ฿' : `${(Number(item.price_snapshot) * item.qty).toLocaleString('th-TH')} ฿`}
                          </span>
                        </div>

                        {item.options_json && item.options_json.length > 0 && (
                          <div className="text-[11px] text-amber-800 pl-6 mt-0.5">
                            + {item.options_json.map((o) => o.name).join(', ')}
                          </div>
                        )}
                        {item.note && (
                          <div className="text-[11px] text-stone-500 italic pl-6">
                            "{item.note}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Actions & Payment */}
                <div className="space-y-3 pt-3 border-t border-stone-100">
                  {/* Payment Info */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {isCash ? (
                        <Banknote className="w-4 h-4 text-stone-500" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-amber-600" />
                      )}
                      <span className="font-medium text-stone-600">
                        {isCash ? 'เงินสดหน้าร้าน' : 'พร้อมเพย์'}
                      </span>
                      {isPaid ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                          จ่ายแล้ว ✅
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                          รอชำระ ⏳
                        </span>
                      )}
                    </div>

                    <div className="font-black text-stone-900 text-sm">
                      {isPrivacyMode ? '*** ฿' : `${Number(order.total).toLocaleString('th-TH')} ฿`}
                    </div>
                  </div>

                  {/* Cash Receive Button if Cash & Not Paid */}
                  {isCash && !isPaid && order.status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleConfirmCash(order.id)}
                      className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>ยืนยันรับเงินสดแล้ว</span>
                    </button>
                  )}

                  {/* Status Progression Buttons */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {order.status === 'pending' && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>รับออเดอร์นี้</span>
                      </button>
                    )}

                    {order.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(order.id, 'cooking')}
                        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                        <span>เริ่มปรุงอาหาร</span>
                      </button>
                    )}

                    {order.status === 'cooking' && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(order.id, 'served')}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                        {isActing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : order.type === 'delivery' ? (
                          <Bike className="w-3.5 h-3.5" />
                        ) : order.type === 'dine_in' ? (
                          <Utensils className="w-3.5 h-3.5" />
                        ) : (
                          <ShoppingBag className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {order.type === 'delivery'
                            ? 'อาหารเสร็จ พร้อมออกส่ง 🛵'
                            : order.type === 'dine_in'
                            ? 'อาหารเสร็จ พร้อมเสิร์ฟที่โต๊ะ 🍽️'
                            : 'อาหารเสร็จ พร้อมให้รับ 🎉'}
                        </span>
                      </button>
                    )}

                    {order.status === 'served' && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                        className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>
                          {order.type === 'delivery'
                            ? 'จัดส่งเรียบร้อยแล้ว (เสร็จสิ้น)'
                            : order.type === 'dine_in'
                            ? 'เสิร์ฟที่โต๊ะเรียบร้อย (เสร็จสิ้น)'
                            : 'ลูกค้ามารับแล้ว (เสร็จสิ้น)'}
                        </span>
                      </button>
                    )}

                    {/* ปุ่มยกเลิกออเดอร์ (ต้องใส่ PIN 4 หลัก ป้องกันพนักงานมือลั่น) */}
                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => setCancelOrderTarget(order)}
                        className="w-full mt-0.5 py-1 px-2 text-[11px] font-medium text-stone-400 hover:text-rose-600 hover:bg-rose-50/70 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>ยกเลิกออเดอร์นี้ (PIN)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PIN Modal สำหรับยืนยันการยกเลิกออเดอร์ */}
      <PinModal
        isOpen={!!cancelOrderTarget}
        onClose={() => setCancelOrderTarget(null)}
        expectedPin={shop.kds_pin || '0000'}
        title={cancelOrderTarget ? `ยืนยันยกเลิกออเดอร์ #${cancelOrderTarget.order_no}` : 'ยืนยันยกเลิกออเดอร์'}
        description="กรุณากรอกรหัส PIN 4 หลักของร้านค้าเพื่อยืนยันการยกเลิกคำสั่งซื้อนี้"
        onSuccess={async () => {
          if (cancelOrderTarget) {
            const targetId = cancelOrderTarget.id;
            setCancelOrderTarget(null);
            await handleUpdateStatus(targetId, 'cancelled');
          }
        }}
      />
    </div>
  );
}
