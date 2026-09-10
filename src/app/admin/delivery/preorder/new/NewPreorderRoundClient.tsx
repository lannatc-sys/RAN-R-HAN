'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPreorderRoundAction } from '@/app/actions/delivery';
import { CalendarClock, ArrowLeft, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';

interface NewPreorderRoundClientProps {
  shopId: string;
}

export function NewPreorderRoundClient({ shopId }: NewPreorderRoundClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState('เปิดจองออเดอร์ล่วงหน้า รอบเทศบาลเมืองแม่ฮ่องสอน');

  // Tomorrow date default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [deliveryDate, setDeliveryDate] = useState(defaultDateStr);
  const [cutoffAt, setCutoffAt] = useState(`${defaultDateStr}T10:00`);
  const [deliveryTimeWindow, setDeliveryTimeWindow] = useState('14:00 น. เป็นต้นไป');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createPreorderRoundAction({
        shop_id: shopId,
        title: title.trim(),
        cutoff_at: new Date(cutoffAt).toISOString(),
        delivery_date: deliveryDate,
        delivery_time_window: deliveryTimeWindow.trim() || null,
      });

      if (!res.success) {
        setError(res.error || 'เกิดข้อผิดพลาดในการเปิดรอบพรีออเดอร์');
      } else if (res.data?.id) {
        router.push(`/admin/delivery/preorder/${res.data.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/admin/delivery/preorder"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        กลับไปหน้ารวมพรีออเดอร์
      </Link>

      <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2.5 mb-2">
          <CalendarClock className="w-6 h-6 text-amber-600" />
          เปิดรอบพรีออเดอร์ใหม่
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mb-6">
          เปิดรอบรับจอง กำหนดเวลาปิดรับยอด และวันที่ต้องการส่งสินค้า
        </p>

        {error && (
          <div className="p-3.5 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              ชื่อรอบพรีออเดอร์ *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="เช่น เปิดจองไก่ย่างสมุนไพร รอบวันเสาร์นี้"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                วันที่จัดส่งสินค้า *
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                เวลาปิดรับออเดอร์ (Cutoff) *
              </label>
              <input
                type="datetime-local"
                required
                value={cutoffAt}
                onChange={e => setCutoffAt(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              ช่วงเวลาจัดส่ง (Time Window)
            </label>
            <input
              type="text"
              value={deliveryTimeWindow}
              onChange={e => setDeliveryTimeWindow(e.target.value)}
              placeholder="เช่น 14:00 - 16:00 น."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <Link
              href="/admin/delivery/preorder"
              className="px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50 shadow-xs"
            >
              {loading ? 'กำลังสร้าง...' : 'เปิดรอบพรีออเดอร์'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
