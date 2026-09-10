'use client';

import Link from 'next/link';
import { PreorderRound } from '@/lib/types';
import { CalendarClock, Plus, Calendar, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface PreorderRoundsClientProps {
  rounds: PreorderRound[];
}

export function PreorderRoundsClient({ rounds }: PreorderRoundsClientProps) {
  const getStatusBadge = (status: PreorderRound['status']) => {
    switch (status) {
      case 'open':
        return {
          label: '🟢 เปิดรับจอง',
          cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold',
        };
      case 'closed':
        return {
          label: '🔒 ปิดรับยอดแล้ว',
          cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
      case 'completed':
        return {
          label: '✓ แปลงเป็นเที่ยวส่งแล้ว',
          cls: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
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
            <CalendarClock className="w-6 h-6 text-amber-600" />
            รอบพรีออเดอร์ (Preorder Rounds)
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            เปิดรอบรับจองล่วงหน้า นำเข้าคอมเมนต์จาก Facebook และกดแปลงเป็นเที่ยวส่งของได้ทันที
          </p>
        </div>

        <Link
          href="/admin/delivery/preorder/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          เปิดรอบพรีออเดอร์ใหม่
        </Link>
      </div>

      {rounds.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-800">
          <CalendarClock className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="font-bold text-stone-800 dark:text-stone-200 text-base mb-1">
            ยังไม่มีรอบพรีออเดอร์
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-5">
            เปิดรอบจองใหม่เพื่อรวบรวมยอดสั่งจากโพสต์ Facebook และเตรียมของส่งได้อย่างแม่นยำ
          </p>
          <Link
            href="/admin/delivery/preorder/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            เปิดรอบพรีออเดอร์แรก
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rounds.map(round => {
            const badge = getStatusBadge(round.status);
            const totalItems = round.items_count || 0;
            const revenue = round.total_revenue || 0;

            return (
              <Link
                key={round.id}
                href={`/admin/delivery/preorder/${round.id}`}
                className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 shadow-xs hover:shadow-md transition-all group block"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base group-hover:text-amber-600 transition-colors">
                    {round.title}
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

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 dark:text-stone-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>วันส่ง: {round.delivery_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>ปิดรับ: {new Date(round.cutoff_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 flex items-center justify-between text-xs mb-4">
                  <span className="text-stone-600 dark:text-stone-400">
                    ยอดสั่งจอง: <strong className="text-stone-900 dark:text-stone-100 font-bold">{totalItems}</strong> รายการ
                  </span>
                  <span className="text-stone-600 dark:text-stone-400">
                    ยอดเงินรวม: <strong className="text-amber-600 font-bold">{revenue.toLocaleString('th-TH')}</strong> ฿
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800/80 text-xs font-semibold text-amber-600">
                  <span>จัดการออเดอร์ & นำเข้าคอมเมนต์</span>
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
