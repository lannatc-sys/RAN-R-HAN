/**
 * Rider domain helpers — pure functions (ทดสอบได้โดยไม่ต้องต่อ DB)
 * อ้างอิง: docs/03-rider-system-architecture.md §6, §7, §10, §11
 */

export type DeliveryEventType =
  | 'departed_to_shop'
  | 'arrived_at_shop'
  | 'picked_up'
  | 'departed_to_customer'
  | 'delivered'
  | 'unreachable_drop'
  | 'breakdown';

export type DispatchStatus =
  | 'pending'
  | 'dispatching'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'failed';

/** ลำดับขั้นตอนงานปกติของไรเดอร์ (Happy path) */
export const RIDER_JOB_FLOW: DeliveryEventType[] = [
  'departed_to_shop',
  'arrived_at_shop',
  'picked_up',
  'departed_to_customer',
  'delivered',
];

/** Event ที่ต้องแนบภาพ POD เสมอ (§9.1) */
export const POD_REQUIRED_EVENTS: DeliveryEventType[] = ['delivered', 'unreachable_drop'];

export function isPodRequired(eventType: DeliveryEventType): boolean {
  return POD_REQUIRED_EVENTS.includes(eventType);
}

/**
 * หา Event ถัดไปที่ไรเดอร์ควรกด จาก Event ล่าสุดที่บันทึกไว้
 * คืน null เมื่อจบงานแล้ว
 */
export function nextRiderEvent(lastEvent: DeliveryEventType | null): DeliveryEventType | null {
  if (lastEvent === 'delivered' || lastEvent === 'unreachable_drop') return null;
  // breakdown ไม่เลื่อนขั้น — ยังอยู่ขั้นเดิม รอ rescue
  if (lastEvent === 'breakdown') return 'departed_to_customer';
  if (lastEvent === null) return RIDER_JOB_FLOW[0];
  const idx = RIDER_JOB_FLOW.indexOf(lastEvent);
  if (idx === -1 || idx + 1 >= RIDER_JOB_FLOW.length) return null;
  return RIDER_JOB_FLOW[idx + 1];
}

/** ตรวจว่า Event ที่ส่งมาต่อจาก Event ล่าสุดได้จริงหรือไม่ (State Guard) */
export function isValidRiderEventTransition(
  lastEvent: DeliveryEventType | null,
  nextEvent: DeliveryEventType
): boolean {
  // Event พิเศษกดได้ตลอดระหว่างที่งานยังไม่จบ
  if (nextEvent === 'breakdown' || nextEvent === 'unreachable_drop') {
    return lastEvent !== 'delivered' && lastEvent !== 'unreachable_drop';
  }
  return nextRiderEvent(lastEvent) === nextEvent;
}

/**
 * ความถี่ในการส่งพิกัด GPS (มิลลิวินาที) ตาม §7
 * - ไม่มี Work Session → 0 (หยุดส่งทันที ตาม PDPA)
 * - Idle (เปิดงานแต่ยังไม่มีออเดอร์) → Low frequency
 * - Active Job (กำลังทำออเดอร์) → High frequency
 */
export const GPS_PING_IDLE_MS = 60_000;
export const GPS_PING_ACTIVE_MS = 15_000;

export function gpsPingIntervalMs(hasOpenSession: boolean, hasActiveJob: boolean): number {
  if (!hasOpenSession) return 0;
  return hasActiveJob ? GPS_PING_ACTIVE_MS : GPS_PING_IDLE_MS;
}

/** วินาทีที่เหลือก่อน Offer หมดอายุ (ไม่ติดลบ) */
export function offerSecondsLeft(timeoutAtIso: string | null, nowMs: number = Date.now()): number {
  if (!timeoutAtIso) return 0;
  const diff = new Date(timeoutAtIso).getTime() - nowMs;
  return diff <= 0 ? 0 : Math.ceil(diff / 1000);
}

/** Phase-1 locked rate: 15 baht for the first 5 km (§11.1). */
export const RIDER_BASE_PAYOUT = 15;
export const RIDER_BASE_DISTANCE_KM = 5;

/**
 * Returns the guaranteed Phase-1 base payout. Distances above 5 km (or missing
 * distance data) require settlement review because the extra-km rate is not yet
 * approved; the client must never invent a percentage split.
 */
export function estimateRiderPayout(distanceKm: number | null | undefined): {
  riderPayout: number;
  needsReview: boolean;
} {
  const distanceKnown = typeof distanceKm === 'number' && Number.isFinite(distanceKm);
  return {
    riderPayout: RIDER_BASE_PAYOUT,
    needsReview: !distanceKnown || distanceKm > RIDER_BASE_DISTANCE_KM,
  };
}

/** ลิงก์นำทาง Google Maps (ฟรี ไม่ต้องใช้ API Key) */
export function mapsNavigationUrl(lat?: number | null, lng?: number | null, fallbackQuery?: string): string | null {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (fallbackQuery && fallbackQuery.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery.trim())}`;
  }
  return null;
}
