'use client';

import Link from 'next/link';
import { DeliveryTrip } from '@/lib/types';
import { Truck, Plus, Calendar, Clock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface TripsClientProps {
  trips: DeliveryTrip[];
}

export function TripsClient({ trips }: TripsClientProps) {
  const getStatusBadge = (status: DeliveryTrip['status']) => {
    switch (status) {
      case 'draft':
        return {
          label: 'ฉบับร่าง',
          cls: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
        };
      case 'in_transit':
        return {
          label: '🛵 กำลังออกส่ง',
          cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold',
        };
      case 'completed':
        return {
          label: '✓ ส่งเสร็จสิ้น',
          cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'cancelled':
        return {
          label: 'ยกเลิก',
          cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        };
      default:
        return { label: status, cls: 'bg-stone-100 text-stone-600' };
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-amber-600" />
            รายการเที่ยวส่งของ (Delivery Trips)
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            รวมรอบส่งอาหารแบบกลุ่มตามเวลาในเขตเทศบาลเมืองแม่ฮ่องสอน พร้อมระบบแผนที่และโทรหาลูกค้า
          </p>
        </div>

        <Link
          href="/admin/delivery/trips/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          สร้างเที่ยวส่งใหม่
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-800">
          <Truck className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="font-bold text-stone-800 dark:text-stone-200 text-base mb-1">
            ยังไม่มีเที่ยวส่งของ
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-5">
            คุณสามารถสร้างเที่ยวส่งของใหม่ หรือแปลงรายการจองจากรอบพรีออเดอร์เข้ามาที่นี่ได้ทันที
          </p>
          <Link
            href="/admin/delivery/trips/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            สร้างเที่ยวส่งแรก
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map(trip => {
            const badge = getStatusBadge(trip.status);
            const total = trip.items_count || 0;
            const delivered = trip.delivered_count || 0;
            const progress = total > 0 ? Math.round((delivered / total) * 100) : 0;

            return (
              <Link
                key={trip.id}
                href={`/admin/delivery/trips/${trip.id}`}
                className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 shadow-xs hover:shadow-md transition-all group block"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base group-hover:text-amber-600 transition-colors">
                    {trip.trip_name}
                  </h3>
                  <span
                    className={clsx(
                      'text-xs px-2.5 py-1 rounded-full border shrink-0',
                      badge.cls
                    )}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500 dark:text-stone-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>วันที่: {trip.trip_date}</span>
                  </div>
                  {trip.delivery_time_window && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>รอบ: {trip.delivery_time_window}</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-stone-600 dark:text-stone-400">
                      ส่งแล้ว: <strong className="text-stone-900 dark:text-stone-100">{delivered}</strong> / {total} ราย
                    </span>
                    <span className="font-semibold text-amber-600">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800/80 text-xs font-semibold text-amber-600">
                  <span>เปิดดูแผนที่ & รายชื่อส่งของ</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
