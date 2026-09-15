export interface RiderLiveMonitorRow {
  rider_id: string;
  shop_id: string;
  shop_name: string;
  display_name: string;
  rider_status: string;
  work_session_id: string | null;
  session_started_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  location_updated_at: string | null;
  gps_age_seconds: number | null;
  location_is_stale: boolean;
  outside_area_since: string | null;
  inside_work_area: boolean | null;
  service_area_enabled: boolean;
  uses_rider_polygon: boolean;
  active_order_id: string | null;
  active_order_no: string | null;
  active_order_dispatch_status: string | null;
  active_offer_id: string | null;
  active_offer_order_id: string | null;
  active_offer_status: string | null;
  active_offer_timeout_at: string | null;
}

export type RiderMonitorStatusFilter =
  | 'all'
  | 'online'
  | 'offline'
  | 'stale'
  | 'outside'
  | 'active_job';

export interface RiderMonitorFilters {
  shopId: string | 'all';
  status: RiderMonitorStatusFilter;
  query: string;
}

export function isRiderMonitorOnline(row: RiderLiveMonitorRow) {
  return Boolean(
    row.work_session_id &&
      row.lat !== null &&
      row.lng !== null &&
      !row.location_is_stale
  );
}

export function filterRiderMonitorRows(
  rows: RiderLiveMonitorRow[],
  filters: RiderMonitorFilters
) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('th-TH');

  return rows.filter((row) => {
    if (filters.shopId !== 'all' && row.shop_id !== filters.shopId) return false;
    if (
      normalizedQuery &&
      !`${row.display_name} ${row.shop_name}`
        .toLocaleLowerCase('th-TH')
        .includes(normalizedQuery)
    ) {
      return false;
    }

    const hasLocation = row.lat !== null && row.lng !== null;
    const matchesStatus = {
      all: true,
      online: isRiderMonitorOnline(row),
      offline: !row.work_session_id || !hasLocation,
      stale: hasLocation && row.location_is_stale,
      outside: row.inside_work_area === false,
      active_job: Boolean(row.active_order_id || row.active_offer_id),
    } satisfies Record<RiderMonitorStatusFilter, boolean>;

    return matchesStatus[filters.status];
  });
}

export function formatGpsAge(seconds: number | null) {
  if (seconds === null) return 'ไม่มีพิกัด GPS';
  if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
}
