import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidKdsPinFormat,
  verifyKdsPin,
  filterActiveKitchenOrders,
  getKdsStatusBadge,
} from '../src/lib/kds';
import type { OrderStatus } from '../src/lib/types';

describe('🍳 Kitchen Display System (KDS) Tests', () => {
  describe('KDS PIN Validation & Verification', () => {
    it('should validate standard 4-digit PIN format', () => {
      assert.equal(isValidKdsPinFormat('0000'), true);
      assert.equal(isValidKdsPinFormat('1234'), true);
      assert.equal(isValidKdsPinFormat('9999'), true);
    });

    it('should reject non-4-digit PINs', () => {
      assert.equal(isValidKdsPinFormat(''), false);
      assert.equal(isValidKdsPinFormat('123'), false);
      assert.equal(isValidKdsPinFormat('12345'), false);
      assert.equal(isValidKdsPinFormat('abcd'), false);
      assert.equal(isValidKdsPinFormat('12a4'), false);
    });

    it('should verify PIN matching shop PIN (using 0000 as default)', () => {
      // Default fallback PIN
      assert.equal(verifyKdsPin('0000', undefined), true);
      assert.equal(verifyKdsPin('0000', null), true);
      assert.equal(verifyKdsPin('1111', null), false);

      // Explicit shop PIN
      assert.equal(verifyKdsPin('8888', '8888'), true);
      assert.equal(verifyKdsPin('0000', '8888'), false);
    });
  });

  describe('Kitchen Queue & Filtering', () => {
    const mockOrders = [
      { id: '1', order_no: 101, status: 'pending' as OrderStatus, created_at: '2026-09-10T10:00:00Z' },
      { id: '2', order_no: 102, status: 'cooking' as OrderStatus, created_at: '2026-09-10T09:55:00Z' },
      { id: '3', order_no: 103, status: 'completed' as OrderStatus, created_at: '2026-09-10T09:40:00Z' },
      { id: '4', order_no: 104, status: 'confirmed' as OrderStatus, created_at: '2026-09-10T09:50:00Z' },
      { id: '5', order_no: 105, status: 'cancelled' as OrderStatus, created_at: '2026-09-10T09:45:00Z' },
    ];

    it('should only include active orders (pending, confirmed, cooking)', () => {
      const active = filterActiveKitchenOrders(mockOrders);
      const activeIds = active.map(o => o.id);

      assert.equal(active.length, 3);
      assert.ok(activeIds.includes('1'));
      assert.ok(activeIds.includes('2'));
      assert.ok(activeIds.includes('4'));
      assert.ok(!activeIds.includes('3')); // completed
      assert.ok(!activeIds.includes('5')); // cancelled
    });

    it('should sort active orders chronologically (FIFO - oldest first)', () => {
      const active = filterActiveKitchenOrders(mockOrders);
      assert.equal(active[0].id, '4'); // 09:50
      assert.equal(active[1].id, '2'); // 09:55
      assert.equal(active[2].id, '1'); // 10:00
    });
  });

  describe('KDS Status Badge & Thai Translation', () => {
    it('should provide correct label and colors for kitchen statuses', () => {
      const pendingBadge = getKdsStatusBadge('pending');
      assert.equal(pendingBadge.label, 'รอยืนยัน/รอชำระ');

      const confirmedBadge = getKdsStatusBadge('confirmed');
      assert.equal(confirmedBadge.label, 'ยืนยันแล้ว');

      const cookingBadge = getKdsStatusBadge('cooking');
      assert.equal(cookingBadge.label, 'กำลังปรุง');

      const servedBadge = getKdsStatusBadge('served');
      assert.equal(servedBadge.label, 'พร้อมรับที่ร้าน');

      const completedBadge = getKdsStatusBadge('completed');
      assert.equal(completedBadge.label, 'เสร็จสิ้น');

      const cancelledBadge = getKdsStatusBadge('cancelled');
      assert.equal(cancelledBadge.label, 'ยกเลิก');
    });
  });
});
