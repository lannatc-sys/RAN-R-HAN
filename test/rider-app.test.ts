import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRiderEvent,
  isValidRiderEventTransition,
  isPodRequired,
  gpsPingIntervalMs,
  offerSecondsLeft,
  splitDeliveryFee,
  mapsNavigationUrl,
  GPS_PING_IDLE_MS,
  GPS_PING_ACTIVE_MS,
} from '../src/lib/rider';

describe('🛵 Rider App — Job State Machine', () => {
  test('เริ่มงานใหม่ → ขั้นแรกคือออกเดินทางไปร้าน', () => {
    assert.equal(nextRiderEvent(null), 'departed_to_shop');
  });

  test('เดินตามลำดับขั้นจนจบงาน', () => {
    assert.equal(nextRiderEvent('departed_to_shop'), 'arrived_at_shop');
    assert.equal(nextRiderEvent('arrived_at_shop'), 'picked_up');
    assert.equal(nextRiderEvent('picked_up'), 'departed_to_customer');
    assert.equal(nextRiderEvent('departed_to_customer'), 'delivered');
    assert.equal(nextRiderEvent('delivered'), null);
  });

  test('งานที่ปิดด้วย unreachable_drop ถือว่าจบแล้ว', () => {
    assert.equal(nextRiderEvent('unreachable_drop'), null);
  });

  test('breakdown ไม่เลื่อนขั้น — กลับมาทำขั้นออกส่งลูกค้าต่อ', () => {
    assert.equal(nextRiderEvent('breakdown'), 'departed_to_customer');
  });

  test('กดข้ามขั้นไม่ได้', () => {
    assert.equal(isValidRiderEventTransition(null, 'delivered'), false);
    assert.equal(isValidRiderEventTransition(null, 'departed_to_shop'), true);
    assert.equal(isValidRiderEventTransition('picked_up', 'arrived_at_shop'), false);
  });

  test('กดซ้ำ event เดิมไม่ได้ (กันมือลั่น/เน็ตกระตุก)', () => {
    assert.equal(isValidRiderEventTransition('picked_up', 'picked_up'), false);
  });

  test('breakdown / unreachable กดได้ตลอดที่งานยังไม่จบ แต่กดหลังจบงานไม่ได้', () => {
    assert.equal(isValidRiderEventTransition('arrived_at_shop', 'breakdown'), true);
    assert.equal(isValidRiderEventTransition('departed_to_customer', 'unreachable_drop'), true);
    assert.equal(isValidRiderEventTransition('delivered', 'breakdown'), false);
    assert.equal(isValidRiderEventTransition('unreachable_drop', 'unreachable_drop'), false);
  });

  test('POD บังคับเฉพาะตอนส่งสำเร็จและตอนติดต่อลูกค้าไม่ได้', () => {
    assert.equal(isPodRequired('delivered'), true);
    assert.equal(isPodRequired('unreachable_drop'), true);
    assert.equal(isPodRequired('picked_up'), false);
    assert.equal(isPodRequired('departed_to_shop'), false);
  });
});

describe('📍 Rider App — GPS Telemetry (PDPA)', () => {
  test('ไม่มี Work Session = หยุดส่งพิกัดทันที', () => {
    assert.equal(gpsPingIntervalMs(false, false), 0);
    assert.equal(gpsPingIntervalMs(false, true), 0);
  });

  test('เปิดงานแต่ยังไม่มีออเดอร์ = ส่งถี่ต่ำ', () => {
    assert.equal(gpsPingIntervalMs(true, false), GPS_PING_IDLE_MS);
  });

  test('กำลังทำออเดอร์ = ส่งถี่สูงกว่า', () => {
    assert.equal(gpsPingIntervalMs(true, true), GPS_PING_ACTIVE_MS);
    assert.ok(GPS_PING_ACTIVE_MS < GPS_PING_IDLE_MS);
  });
});

describe('⏱️ Rider App — Offer Countdown', () => {
  const now = new Date('2026-09-11T03:00:00.000Z').getTime();

  test('นับถอยหลังจาก timeout_at ของเซิร์ฟเวอร์', () => {
    assert.equal(offerSecondsLeft('2026-09-11T03:00:30.000Z', now), 30);
  });

  test('หมดเวลาแล้วต้องเป็น 0 ไม่ติดลบ', () => {
    assert.equal(offerSecondsLeft('2026-09-11T02:59:00.000Z', now), 0);
  });

  test('ไม่มี timeout_at = ถือว่าหมดเวลา', () => {
    assert.equal(offerSecondsLeft(null, now), 0);
  });
});

describe('💰 Rider App — Delivery Fee Split (80/20)', () => {
  test('แบ่งค่าจัดส่ง 80/20 และรวมกันต้องเท่ายอดเดิมเสมอ', () => {
    const { riderPayout, riderPool } = splitDeliveryFee(25);
    assert.equal(riderPayout, 20);
    assert.equal(riderPool, 5);
    assert.equal(riderPayout + riderPool, 25);
  });

  test('เศษทศนิยมต้องไม่ทำให้ยอดรวมเพี้ยน', () => {
    const fee = 33.33;
    const { riderPayout, riderPool } = splitDeliveryFee(fee);
    assert.equal(Math.round((riderPayout + riderPool) * 100) / 100, fee);
  });

  test('ค่าจัดส่ง 0 หรือค่าผิดปกติ = 0 ทั้งคู่', () => {
    assert.deepEqual(splitDeliveryFee(0), { riderPayout: 0, riderPool: 0 });
    assert.deepEqual(splitDeliveryFee(-10), { riderPayout: 0, riderPool: 0 });
    assert.deepEqual(splitDeliveryFee(NaN), { riderPayout: 0, riderPool: 0 });
  });
});

describe('🗺️ Rider App — Navigation Link', () => {
  test('มีพิกัด → ใช้ลิงก์นำทางแบบพิกัด', () => {
    assert.equal(
      mapsNavigationUrl(19.3013, 97.9654),
      'https://www.google.com/maps/dir/?api=1&destination=19.3013,97.9654'
    );
  });

  test('ไม่มีพิกัด → fallback เป็นการค้นหาที่อยู่', () => {
    const url = mapsNavigationUrl(null, null, 'ถนนขุนลุมประพาส แม่ฮ่องสอน');
    assert.ok(url && url.startsWith('https://www.google.com/maps/search/?api=1&query='));
  });

  test('ไม่มีทั้งพิกัดและที่อยู่ → null (ไม่โชว์ปุ่มนำทาง)', () => {
    assert.equal(mapsNavigationUrl(null, null), null);
    assert.equal(mapsNavigationUrl(null, null, '   '), null);
  });
});
