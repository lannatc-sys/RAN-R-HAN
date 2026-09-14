import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isOrderTrackingFinal } from '../src/lib/order-tracking';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const TRACKER = 'src/app/order/[orderId]/OrderTrackerClient.tsx';

describe('หน้าติดตาม: ออเดอร์จัดส่งต้องถามต่อหลังอาหารเสร็จ', () => {
  it('delivery + served ยังไม่จบ ต้องถามต่อ', () => {
    assert.equal(
      isOrderTrackingFinal('served', 'delivery'),
      false,
      'หยุดที่ served แล้วลูกค้าจะไม่เห็นว่าของส่งถึง'
    );
  });

  it('delivery + completed จบแล้ว', () => {
    assert.equal(isOrderTrackingFinal('completed', 'delivery'), true);
  });

  it('delivery + cancelled จบแล้ว', () => {
    assert.equal(isOrderTrackingFinal('cancelled', 'delivery'), true);
  });

  it('delivery ระหว่างทางทุกสถานะยังไม่จบ', () => {
    for (const status of ['pending', 'confirmed', 'cooking', 'served']) {
      assert.equal(
        isOrderTrackingFinal(status, 'delivery'),
        false,
        `delivery + ${status} ต้องยังถามต่อ`
      );
    }
  });
});

describe('หน้าติดตาม: ออเดอร์แบบอื่นจบที่ served เหมือนเดิม', () => {
  it('takeaway + served จบแล้ว', () => {
    assert.equal(isOrderTrackingFinal('served', 'takeaway'), true);
  });

  it('dine_in + served จบแล้ว', () => {
    assert.equal(isOrderTrackingFinal('served', 'dine_in'), true);
  });

  it('ไม่รู้ชนิดออเดอร์ ให้ถือว่าจบที่ served แบบเดิม', () => {
    assert.equal(isOrderTrackingFinal('served', null), true);
    assert.equal(isOrderTrackingFinal('served', undefined), true);
  });

  it('takeaway ระหว่างทางยังไม่จบ', () => {
    for (const status of ['pending', 'confirmed', 'cooking']) {
      assert.equal(isOrderTrackingFinal(status, 'takeaway'), false);
    }
  });
});

describe('หน้าติดตาม: ค่าที่ขาดหายต้องไม่ทำให้หยุดถามเงียบ ๆ', () => {
  it('ไม่มีสถานะ ถือว่ายังไม่จบ', () => {
    assert.equal(isOrderTrackingFinal(null, 'delivery'), false);
    assert.equal(isOrderTrackingFinal(undefined, 'takeaway'), false);
    assert.equal(isOrderTrackingFinal('', 'takeaway'), false);
  });
});

describe('หน้าติดตาม: component ใช้ตัวตัดสินตัวนี้จริง', () => {
  it('ไม่เหลือรายการ final แบบ hardcode ที่รวม served ไว้', () => {
    const code = stripTs(source(TRACKER));
    assert.ok(
      !/FINAL_STATUSES\s*=\s*\[\s*'served'/.test(code),
      'รายการเดิมที่ถือ served เป็นขั้นสุดท้ายของทุกชนิดออเดอร์ต้องถูกเอาออก'
    );
    assert.match(code, /isOrderTrackingFinal\(order\.status, order\.type\)/);
  });

  it('effect ผูกกับชนิดออเดอร์ด้วย ไม่ใช่สถานะอย่างเดียว', () => {
    assert.match(stripTs(source(TRACKER)), /\[order\.id, order\.status, order\.type\]/);
  });
});
