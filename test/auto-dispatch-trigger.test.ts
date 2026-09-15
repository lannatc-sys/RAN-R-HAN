import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  shouldAutoDispatch,
  KITCHEN_READY_STATUS,
  type AutoDispatchCandidate,
} from '../src/lib/dispatch-trigger';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const deliveryOrder = (patch: Partial<AutoDispatchCandidate> = {}): AutoDispatchCandidate => ({
  type: 'delivery',
  dispatch_status: null,
  delivery_lat: 19.3005,
  delivery_lng: 97.9678,
  ...patch,
});

describe('1. ครัวกดว่าอาหารเสร็จแล้วต้องจุด dispatch', () => {
  it('ออเดอร์จัดส่งที่ยังไม่เคยจ่ายงาน ต้อง trigger', () => {
    assert.equal(shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder()), true);
  });

  it('ออเดอร์ที่เคยจ่ายงานแล้วล้มเหลว ต้อง trigger ซ้ำได้', () => {
    assert.equal(
      shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder({ dispatch_status: 'failed' })),
      true
    );
  });

  it('สถานะที่ครัวใช้บอกว่าอาหารเสร็จคือ served ไม่ใช่ ready', () => {
    // ระบบนี้ไม่มีค่า 'ready' ใน order_status enum
    assert.equal(KITCHEN_READY_STATUS, 'served');
  });
});

describe('2. ไม่มีไรเดอร์ที่รับงานได้ ต้องไม่ทำให้การกด Ready ล้ม', () => {
  it('ตัวตัดสินไม่รู้จักไรเดอร์เลย จึงไม่มีทางทำให้การกด Ready ล้มจากเรื่องไรเดอร์', () => {
    const fn = shouldAutoDispatch.toString();
    assert.ok(!/rider/i.test(fn), 'ตัวตัดสินต้องไม่ยุ่งกับไรเดอร์');
  });

  it('ผลของ dispatch ไม่ถูกนำมาคิดกับค่าที่ action คืนกลับ', () => {
    const code = stripTs(source('src/app/actions/order.ts'));
    const start = code.indexOf('shouldAutoDispatch(newStatus, beforeUpdate)');
    assert.ok(start !== -1, 'ไม่พบจุดเรียกตัวตัดสิน');
    const block = code.slice(start, code.indexOf('return { success: true };', start));

    assert.ok(
      !/await\s+import\(/.test(block) && !/await\s+dispatchOrderAction/.test(block),
      'ห้าม await ผลของ dispatch เพราะจะทำให้การกด Ready ค้างหรือล้มตามไปด้วย'
    );
    assert.match(block, /\.catch\(/, 'ต้องมี catch กันไม่ให้ promise ที่ล้มลอยหลุดไป');
  });
});

describe('3. dispatch ล้ม ต้องไม่ย้อนสถานะที่ครัวตั้งใจเปลี่ยน', () => {
  it('ไม่มีการอัปเดต orders ซ้ำหลังจากจุด dispatch', () => {
    const code = stripTs(source('src/app/actions/order.ts'));
    const triggerIdx = code.indexOf('shouldAutoDispatch(newStatus, beforeUpdate)');
    const returnIdx = code.indexOf('return { success: true };', triggerIdx);
    const block = code.slice(triggerIdx, returnIdx);

    assert.ok(
      !/\.update\(/.test(block),
      'บล็อกจุด dispatch ต้องไม่เขียนตาราง orders อีก ไม่งั้นเสี่ยงย้อนสถานะครัว'
    );
  });

  it('ความล้มเหลวถูกบันทึกไว้ ไม่ถูกกลืนเงียบ', () => {
    const code = stripTs(source('src/app/actions/order.ts'));
    assert.match(code, /\[auto-dispatch\]/, 'ต้อง log ด้วยป้ายที่ค้นหาได้ตอนสืบสวน');
  });
});

describe('4. สถานะอื่นห้ามจุด dispatch', () => {
  for (const status of ['pending', 'confirmed', 'cooking', 'completed', 'cancelled']) {
    it(`สถานะ ${status} ต้องไม่ trigger`, () => {
      assert.equal(shouldAutoDispatch(status, deliveryOrder()), false);
    });
  }

  it('ออเดอร์ที่ไม่ใช่จัดส่งต้องไม่ trigger', () => {
    for (const type of ['takeaway', 'dine_in', null]) {
      assert.equal(
        shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder({ type })),
        false,
        `type=${type} ไม่ควร trigger`
      );
    }
  });

  it('ออเดอร์จัดส่งที่ไม่มีพิกัดปลายทางต้องไม่ trigger', () => {
    assert.equal(
      shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder({ delivery_lat: null })),
      false
    );
    assert.equal(
      shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder({ delivery_lng: null })),
      false
    );
    assert.equal(
      shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder({ delivery_lat: Number.NaN })),
      false,
      'NaN ต้องไม่ผ่านเหมือน null'
    );
  });

  it('ไม่พบออเดอร์ต้องไม่ trigger', () => {
    assert.equal(shouldAutoDispatch(KITCHEN_READY_STATUS, null), false);
    assert.equal(shouldAutoDispatch(KITCHEN_READY_STATUS, undefined), false);
  });
});

describe('5. กดซ้ำต้องไม่จ่ายงานซ้อน', () => {
  for (const state of ['dispatching', 'assigned', 'in_transit', 'delivered']) {
    it(`dispatch_status=${state} ต้องไม่ trigger อีก`, () => {
      assert.equal(
        shouldAutoDispatch(KITCHEN_READY_STATUS, deliveryOrder({ dispatch_status: state })),
        false
      );
    });
  }

  it('อ่านสภาพออเดอร์ก่อน update เพื่อให้เห็น dispatch_status ตอนที่ครัวกด', () => {
    const code = stripTs(source('src/app/actions/order.ts'));
    const readIdx = code.indexOf("select('type, dispatch_status, delivery_lat, delivery_lng')");
    const writeIdx = code.indexOf('.update({ status: newStatus');
    assert.ok(readIdx !== -1, 'ต้องอ่านสภาพออเดอร์ก่อน');
    assert.ok(writeIdx !== -1);
    assert.ok(readIdx < writeIdx, 'ต้องอ่านก่อนเขียน ไม่งั้นเห็นสถานะหลังเปลี่ยนแล้ว');
  });
});

describe('ไม่เขียน dispatch logic ซ้ำ', () => {
  it('ตัวตัดสินไม่แตะฐานข้อมูลและไม่รู้จักตารางของ dispatch', () => {
    const lib = stripTs(source('src/lib/dispatch-trigger.ts'));
    const forbidden = ['supabase', 'createClient', 'dispatch_offers', 'find_available_riders'];
    for (const needle of forbidden) {
      assert.ok(!lib.includes(needle), 'dispatch-trigger.ts must not reference ' + needle);
    }
  });

  it('การจ่ายงานยังเรียกผ่าน dispatchOrderAction ตัวเดิม', () => {
    assert.match(stripTs(source('src/app/actions/order.ts')), /dispatchOrderAction\(orderId\)/);
  });
});
