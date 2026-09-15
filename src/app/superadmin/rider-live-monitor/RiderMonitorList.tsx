'use client';

import { Bike, BriefcaseBusiness, Clock3, MapPin, Radio } from 'lucide-react';
import type { RiderLiveMonitorRow } from '@/lib/rider-live-monitor';
import { formatGpsAge, isRiderMonitorOnline } from '@/lib/rider-live-monitor';

interface RiderMonitorListProps {
  rows: RiderLiveMonitorRow[];
  selectedRiderId: string | null;
  onSelectRider: (riderId: string) => void;
}

const thaiTime = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTime(value: string | null) {
  return value ? thaiTime.format(new Date(value)) : '—';
}

function areaLabel(row: RiderLiveMonitorRow) {
  if (!row.service_area_enabled) return 'ไม่ได้เปิดตรวจพื้นที่';
  if (row.inside_work_area === null) return 'ไม่มี GPS ให้ตรวจ';
  return row.inside_work_area ? 'อยู่ในเขต' : 'อยู่นอกเขต';
}

export function RiderMonitorList({
  rows,
  selectedRiderId,
  onSelectRider,
}: RiderMonitorListProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
        <Bike className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
        <h2 className="mt-2 text-sm font-bold text-slate-800">ไม่พบไรเดอร์ตามตัวกรอง</h2>
        <p className="mt-1 text-xs text-slate-500">ลองเลือกร้านหรือสถานะอื่น</p>
      </div>
    );
  }

  return (
    <ul className="max-h-[620px] space-y-2 overflow-y-auto pr-1" role="list">
      {rows.map((row) => {
        const online = isRiderMonitorOnline(row);
        const selected = row.rider_id === selectedRiderId;
        return (
          <li key={row.rider_id}>
            <button
              type="button"
              onClick={() => onSelectRider(row.rider_id)}
              aria-pressed={selected}
              className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                selected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-900">
                    {row.display_name}
                  </h2>
                  <p className="truncate text-[11px] text-slate-500">{row.shop_name}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                    online
                      ? 'bg-emerald-100 text-emerald-800'
                      : row.location_is_stale && row.lat !== null
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {online ? 'ออนไลน์' : row.lat !== null ? 'GPS เก่า' : 'ออฟไลน์'}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                <div>
                  <dt className="flex items-center gap-1 text-slate-500">
                    <Radio className="h-3 w-3" aria-hidden="true" /> GPS
                  </dt>
                  <dd className={row.location_is_stale ? 'font-semibold text-amber-800' : 'text-slate-800'}>
                    {formatGpsAge(row.gps_age_seconds)}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-slate-500">
                    <Clock3 className="h-3 w-3" aria-hidden="true" /> Session
                  </dt>
                  <dd className="text-slate-800">
                    {row.work_session_id ? `เปิด · ${formatTime(row.session_started_at)}` : 'ปิด'}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-slate-500">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> พื้นที่
                  </dt>
                  <dd className={row.inside_work_area === false ? 'font-semibold text-rose-700' : 'text-slate-800'}>
                    {areaLabel(row)}
                    {row.uses_rider_polygon ? ' · Polygon' : ' · Radius'}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-slate-500">
                    <BriefcaseBusiness className="h-3 w-3" aria-hidden="true" /> งาน
                  </dt>
                  <dd className="text-slate-800">
                    {row.active_order_no
                      ? `#${row.active_order_no} · ${row.active_order_dispatch_status}`
                      : row.active_offer_id
                        ? 'มี offer รอตอบรับ'
                        : 'ไม่มีงาน active'}
                  </dd>
                </div>
              </dl>

              {row.outside_area_since && (
                <p className="mt-3 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-800">
                  เริ่มอยู่นอกเขตเมื่อ {formatTime(row.outside_area_since)}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
