'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, Signal, SignalZero, TriangleAlert } from 'lucide-react';
import { getRiderLiveMonitorSnapshotAction } from '@/app/actions/superadmin';
import {
  filterRiderMonitorRows,
  isRiderMonitorOnline,
  type RiderLiveMonitorRow,
  type RiderMonitorStatusFilter,
} from '@/lib/rider-live-monitor';
import { RiderMonitorList } from './RiderMonitorList';

const RiderLiveMap = dynamic(() => import('./RiderLiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 sm:h-[480px]">
      กำลังโหลดแผนที่ไรเดอร์...
    </div>
  ),
});

const POLL_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

interface RiderLiveMonitorClientProps {
  initialRows: RiderLiveMonitorRow[];
  initialError: string | null;
  initialSnapshotAt: string | null;
}

export function RiderLiveMonitorClient({
  initialRows,
  initialError,
  initialSnapshotAt,
}: RiderLiveMonitorClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState(initialError);
  const [snapshotAt, setSnapshotAt] = useState(initialSnapshotAt);
  const [refreshing, setRefreshing] = useState(false);
  const [shopId, setShopId] = useState<string | 'all'>('all');
  const [status, setStatus] = useState<RiderMonitorStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const backoffRef = useRef(POLL_INTERVAL_MS);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('อุปกรณ์ออฟไลน์ ระบบหยุด polling ชั่วคราว');
      backoffRef.current = MAX_BACKOFF_MS;
      return;
    }

    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const result = await getRiderLiveMonitorSnapshotAction();
      if (!result.success) {
        setError(result.error ?? 'โหลดสถานะไรเดอร์ไม่สำเร็จ');
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        return;
      }
      setRows(result.riders ?? []);
      setSnapshotAt(result.snapshotAt ?? new Date().toISOString());
      setError(null);
      backoffRef.current = POLL_INTERVAL_MS;
    } catch {
      setError('เชื่อมต่อสถานะไรเดอร์ไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ');
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (
        stopped ||
        document.visibilityState !== 'visible' ||
        !navigator.onLine
      ) {
        return;
      }
      timer = setTimeout(async () => {
        await refresh();
        schedule();
      }, backoffRef.current);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh().finally(schedule);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const handleOnline = () => {
      backoffRef.current = POLL_INTERVAL_MS;
      void refresh().finally(schedule);
    };
    const handleOffline = () => {
      setError('อุปกรณ์ออฟไลน์ ระบบหยุด polling ชั่วคราว');
      if (timer) clearTimeout(timer);
      timer = null;
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    schedule();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refresh]);

  const shops = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.shop_id, row.shop_name])))
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [rows]
  );
  const filteredRows = useMemo(
    () => filterRiderMonitorRows(rows, { shopId, status, query }),
    [query, rows, shopId, status]
  );
  const stats = useMemo(() => ({
    all: rows.length,
    online: rows.filter(isRiderMonitorOnline).length,
    stale: rows.filter((row) => row.lat !== null && row.location_is_stale).length,
    outside: rows.filter((row) => row.inside_work_area === false).length,
    active: rows.filter((row) => row.active_order_id || row.active_offer_id).length,
  }), [rows]);

  useEffect(() => {
    if (
      selectedRiderId &&
      !filteredRows.some((row) => row.rider_id === selectedRiderId)
    ) {
      setSelectedRiderId(null);
    }
  }, [filteredRows, selectedRiderId]);

  return (
    <div className="space-y-4">
      <section aria-label="สรุปสถานะไรเดอร์" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['ทั้งหมด', stats.all],
          ['ออนไลน์', stats.online],
          ['GPS เก่า', stats.stale],
          ['นอกเขต', stats.outside],
          ['มีงาน/Offer', stats.active],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3" aria-label="ตัวกรองไรเดอร์">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="rider-monitor-search" className="mb-1 block text-[11px] font-semibold text-slate-600">
              ค้นหาไรเดอร์หรือร้าน
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                id="rider-monitor-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              />
            </div>
          </div>
          <div>
            <label htmlFor="rider-monitor-shop" className="mb-1 block text-[11px] font-semibold text-slate-600">ร้าน</label>
            <select id="rider-monitor-shop" value={shopId} onChange={(event) => setShopId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
              <option value="all">ทุกร้าน</option>
              {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rider-monitor-status" className="mb-1 block text-[11px] font-semibold text-slate-600">สถานะ</label>
            <select id="rider-monitor-status" value={status} onChange={(event) => setStatus(event.target.value as RiderMonitorStatusFilter)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
              <option value="all">ทุกสถานะ</option>
              <option value="online">ออนไลน์</option>
              <option value="offline">ออฟไลน์</option>
              <option value="stale">GPS เก่า</option>
              <option value="outside">นอกเขต</option>
              <option value="active_job">มีงานหรือ Offer</option>
            </select>
          </div>
        </div>
      </section>

      {error && (
        <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <RiderLiveMap rows={filteredRows} selectedRiderId={selectedRiderId} onSelectRider={setSelectedRiderId} />
        <aside aria-label="รายการไรเดอร์" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              {stats.online > 0 ? <Signal className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <SignalZero className="h-4 w-4 text-slate-400" aria-hidden="true" />}
              แสดง {filteredRows.length} จาก {rows.length} คน
            </p>
            <button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              รีเฟรช
            </button>
          </div>
          <RiderMonitorList rows={filteredRows} selectedRiderId={selectedRiderId} onSelectRider={setSelectedRiderId} />
        </aside>
      </div>

      <p className="text-[11px] text-slate-500">
        {snapshotAt ? `ข้อมูลล่าสุด ${new Date(snapshotAt).toLocaleTimeString('th-TH')}` : 'ยังไม่มี snapshot'}
        {' · '}GPS เกิน 90 วินาทีถือว่าเก่าและจะไม่ถูกเลือกเข้า dispatch
      </p>
    </div>
  );
}
