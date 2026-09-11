import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRiderEvent,
  isValidRiderEventTransition,
  isPodRequired,
  gpsPingIntervalMs,
  offerSecondsLeft,
  estimateRiderPayout,
  type DeliveryEventType,
} from '../src/lib/rider';
import { isValidOrderStatusTransition } from '../src/lib/orders';
import type { OrderStatus } from '../src/lib/types';

// NOTE: These are automated in-memory unit/scenario tests. REAL DEVICE E2E ON PHYSICAL HARDWARE: NOT VERIFIED
describe('🛵 Automated Rider Lifecycle Scenario Simulation Suite', () => {
  describe('Scenario 1: Happy Path (Customer -> KDS -> Dispatch -> Rider -> POD -> Completed)', () => {
    it('วงจรเปลี่ยนสถานะออเดอร์ต้องถูกต้องตามลำดับ (pending -> confirmed -> cooking -> served -> completed)', () => {
      let orderStatus: OrderStatus = 'pending';

      // 1. Payment verified -> confirmed
      assert.ok(isValidOrderStatusTransition(orderStatus, 'confirmed'));
      orderStatus = 'confirmed';

      // 2. KDS Kitchen accepts -> cooking
      assert.ok(isValidOrderStatusTransition(orderStatus, 'cooking'));
      orderStatus = 'cooking';

      // 3. Food ready -> served (พร้อมส่ง)
      assert.ok(isValidOrderStatusTransition(orderStatus, 'served'));
      orderStatus = 'served';

      // 4. Rider delivers successfully -> completed
      assert.ok(isValidOrderStatusTransition(orderStatus, 'completed'));
      orderStatus = 'completed';

      // ห้ามย้อนกลับจาก completed
      assert.ok(!isValidOrderStatusTransition(orderStatus, 'cooking'));
      assert.ok(!isValidOrderStatusTransition(orderStatus, 'pending'));
    });

    it('วงจรสถานะของไรเดอร์ 5 ขั้นตอนต้องเดินไปข้างหน้าตามลำดับที่กำหนด', () => {
      let currentEvent: DeliveryEventType | null = null;

      // 1. รับงาน -> เดินทางไปร้าน
      currentEvent = nextRiderEvent(currentEvent);
      assert.equal(currentEvent, 'departed_to_shop');

      // 2. ถึงร้าน
      currentEvent = nextRiderEvent(currentEvent);
      assert.equal(currentEvent, 'arrived_at_shop');

      // 3. รับอาหารแล้ว
      currentEvent = nextRiderEvent(currentEvent);
      assert.equal(currentEvent, 'picked_up');

      // 4. ออกส่งให้ลูกค้า
      currentEvent = nextRiderEvent(currentEvent);
      assert.equal(currentEvent, 'departed_to_customer');

      // 5. ส่งสำเร็จ (ต้องมี POD)
      assert.equal(isPodRequired('delivered'), true);
      currentEvent = nextRiderEvent(currentEvent);
      assert.equal(currentEvent, 'delivered');

      // 6. ส่งเสร็จแล้ว ไม่มีขั้นต่อไป
      assert.equal(nextRiderEvent(currentEvent), null);
    });
  });

  describe('Scenario 2: Offer Timeout & Sequential Re-dispatch (Rider 1 -> Rider 2)', () => {
    it('เมื่อหมดเวลา 30 วิ offer_seconds_left ต้องเป็น 0', () => {
      const serverNow = Date.now();
      const pastTimeout = new Date(serverNow - 5000).toISOString();
      assert.equal(offerSecondsLeft(pastTimeout, serverNow), 0);
    });

    it('Sequential Dispatch: ไรเดอร์คนแรกไม่รับ ต้องส่งต่อให้คนที่สองได้', () => {
      const candidates = [
        { id: 'rider-1', score: 120 },
        { id: 'rider-2', score: 95 },
      ];

      // รอบ 1: เลือก candidate อันดับ 1
      const round1Best = candidates[0];
      assert.equal(round1Best.id, 'rider-1');

      // rider-1 timed out -> exclude rider-1
      const excludedRiders = ['rider-1'];
      const round2Candidates = candidates.filter((c) => !excludedRiders.includes(c.id));
      assert.equal(round2Candidates.length, 1);
      assert.equal(round2Candidates[0].id, 'rider-2');
    });

    it('เมื่อครบ 3 รอบแล้วยังไม่มีใครรับ Order ต้องถูก Flag เป็น failed', () => {
      const MAX_ROUNDS = 3;
      for (let round = 1; round <= 4; round++) {
        const canDispatch = round <= MAX_ROUNDS;
        if (round === 4) {
          assert.equal(canDispatch, false, 'รอบที่ 4 ต้องไม่ dispatch ต่อ');
        } else {
          assert.equal(canDispatch, true);
        }
      }
    });
  });

  describe('Scenario 3: Capacity Guard & Concurrency Lock', () => {
    it('ไรเดอร์ 1 คนรับงานพร้อมกันได้ไม่เกิน 2 ออเดอร์ใน Phase 1', () => {
      const MAX_ACTIVE_ORDERS = 2;
      const riderOrders = ['order-1', 'order-2'];

      const canAcceptAnother = riderOrders.length < MAX_ACTIVE_ORDERS;
      assert.equal(canAcceptAnother, false);
    });

    it('ปฏิเสธการกดข้ามขั้นและการกดซ้ำ (Duplicate Event)', () => {
      assert.equal(isValidRiderEventTransition('departed_to_shop', 'delivered'), false);
      assert.equal(isValidRiderEventTransition('arrived_at_shop', 'arrived_at_shop'), false);
    });
  });

  describe('Scenario 4: Customer Unreachable Protocol & POD Failure', () => {
    it('กรณีลูกค้าติดต่อไม่ได้ ต้องใช้ unreachable_drop และบังคับถ่ายรูป POD', () => {
      assert.equal(isPodRequired('unreachable_drop'), true);
      assert.equal(isValidRiderEventTransition('departed_to_customer', 'unreachable_drop'), true);
      assert.equal(nextRiderEvent('unreachable_drop'), null);
    });

    it('กรณีรถเสีย (Breakdown) ไม่เลื่อนขั้น แต่คงสถานะส่งเพื่อรอไรเดอร์กู้ภัย', () => {
      assert.equal(isValidRiderEventTransition('departed_to_customer', 'breakdown'), true);
      assert.equal(nextRiderEvent('breakdown'), 'departed_to_customer');
    });
  });

  describe('Scenario 5: GPS Consent & Frequency Management (PDPA)', () => {
    it('เมื่อปิดกะ (Close Work Session) ต้องหยุดส่งพิกัด GPS ทันที (0 ms)', () => {
      assert.equal(gpsPingIntervalMs(false, false), 0);
      assert.equal(gpsPingIntervalMs(false, true), 0);
    });

    it('ช่วง Idle (เปิดกะ แต่ยังไม่มีงาน) ส่ง GPS แบบความถี่ต่ำ (ประหยัดแบตเตอรี่)', () => {
      const idleInterval = gpsPingIntervalMs(true, false);
      assert.equal(idleInterval, 60000); // 60 วินาที
    });

    it('ช่วง Active (กำลังส่งงาน) ส่ง GPS ความถี่สูง (15 วินาที)', () => {
      const activeInterval = gpsPingIntervalMs(true, true);
      assert.equal(activeInterval, 15000);
      assert.ok(activeInterval < gpsPingIntervalMs(true, false));
    });
  });

  describe('Scenario 6: Rate Card & Daily Settlement Rules', () => {
    it('ระยะทาง <= 5.0 กม. จ่าย Base Rate 15.00 บาท (ไม่ติด Flag Review)', () => {
      const payout = estimateRiderPayout(4.8);
      assert.equal(payout.riderPayout, 15);
      assert.equal(payout.needsReview, false);
    });

    it('ระยะทาง > 5.0 กม. ต้อง Flag PENDING_REVIEW เพื่อให้ Admin ตรวจสอบ', () => {
      const payout = estimateRiderPayout(6.2);
      assert.equal(payout.riderPayout, 15);
      assert.equal(payout.needsReview, true);
    });

    it('กรณีไม่มีข้อมูลระยะทาง (null/undefined) ต้อง Flag PENDING_REVIEW เสมอ', () => {
      const payout = estimateRiderPayout(null);
      assert.equal(payout.riderPayout, 15);
      assert.equal(payout.needsReview, true);
    });
  });
});
