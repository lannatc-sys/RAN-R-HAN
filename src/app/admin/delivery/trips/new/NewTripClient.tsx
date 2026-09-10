'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeliveryTripAction } from '@/app/actions/delivery';
import { Truck, ArrowLeft, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';

interface NewTripClientProps {
  shopId: string;
}

export function NewTripClient({ shopId }: NewTripClientProps) {
  const router = useRouter();
  const [tripName, setTripName] = useState('รอบส่งบ่าย เทศบาลเมืองแม่ฮ่องสอน');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryTimeWindow, setDeliveryTimeWindow] = useState('14:00 - 15:30 น.');
  const [cutoffAt, setCutoffAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createDeliveryTripAction({
        shop_id: shopId,
        trip_name: tripName.trim(),
        trip_date: tripDate,
        delivery_time_window: deliveryTimeWindow.trim() || null,
        cutoff_at: cutoffAt ? new Date(cutoffAt).toISOString() : null,
      });

      if (!res.success) {
        setError(res.error || 'เกิดข้อผิดพลาดในการสร้างเที่ยวส่ง');
      } else if (res.data?.id) {
        router.push(`/admin/delivery/trips/${res.data.id}`);
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
        href="/admin/delivery/trips"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        กลับไปหน้ารายการเที่ยวส่ง
      </Link>

      <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2.5 mb-2">
          <Truck className="w-6 h-6 text-amber-600" />
          สร้างเที่ยวส่งของใหม่
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mb-6">
          กำหนดชื่อรอบ วันที่ และช่วงเวลาที่จะออกเดินทางส่งสินค้า
        </p>

        {error && (
          <div className="p-3.5 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              ชื่อเที่ยวส่ง *
            </label>
            <input
              type="text"
              required
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              placeholder="เช่น รอบบ่าย 14:00 น. ในเมือง"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                วันที่จัดส่ง *
              </label>
              <input
                type="date"
                required
                value={tripDate}
                onChange={e => setTripDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                ช่วงเวลาส่ง (Time Window)
              </label>
              <input
                type="text"
                value={deliveryTimeWindow}
                onChange={e => setDeliveryTimeWindow(e.target.value)}
                placeholder="เช่น 14:00 - 15:30 น."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <Link
              href="/admin/delivery/trips"
              className="px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50 shadow-xs"
            >
              {loading ? 'กำลังสร้าง...' : 'สร้างและไปหน้าจัดของ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
