import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderSchema } from '../src/lib/validations/order';
import { isValidOrderStatusTransition, calculateOrderFinancials } from '../src/lib/orders';
import type { OrderStatus } from '../src/lib/types';

describe('📦 Order System Tests', () => {
  describe('Zod Schema Validation (createOrderSchema)', () => {
    const validShopId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const validMenuId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

    it('should validate a valid customer takeaway order', () => {
      const input = {
        shop_id: validShopId,
        type: 'takeaway' as const,
        customer_phone: '0812345678',
        source: 'customer' as const,
        payment_method: 'promptpay' as const,
        items: [
          {
            menu_item_id: validMenuId,
            qty: 2,
            option_ids: [],
          },
        ],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, true);
    });

    it('should validate a valid staff walk-in order', () => {
      const input = {
        shop_id: validShopId,
        type: 'takeaway' as const,
        source: 'staff' as const,
        payment_method: 'cash' as const,
        items: [
          {
            menu_item_id: validMenuId,
            qty: 1,
            option_ids: [],
          },
        ],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, true);
    });

    it('should validate a valid dine-in order with table_no', () => {
      const input = {
        shop_id: validShopId,
        type: 'dine_in' as const,
        table_no: 'A1',
        source: 'customer' as const,
        payment_method: 'promptpay' as const,
        items: [{ menu_item_id: validMenuId, qty: 1 }],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, true);
    });

    it('should validate a valid delivery order with address', () => {
      const input = {
        shop_id: validShopId,
        type: 'delivery' as const,
        customer_name: 'สมชาย รักดี',
        customer_phone: '0891234567',
        delivery_address: '123/45 หมู่บ้านสุขใจ',
        delivery_lat: 18.7883,
        delivery_lng: 98.9853,
        source: 'customer' as const,
        payment_method: 'promptpay' as const,
        items: [{ menu_item_id: validMenuId, qty: 1 }],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, true);
    });

    it('should reject an order with empty items array', () => {
      const input = {
        shop_id: validShopId,
        type: 'takeaway' as const,
        items: [],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some(i => i.path.includes('items')));
      }
    });

    it('should reject an item with qty <= 0', () => {
      const input = {
        shop_id: validShopId,
        items: [
          {
            menu_item_id: validMenuId,
            qty: 0,
          },
        ],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, false);
    });

    it('should reject invalid UUID for shop_id', () => {
      const input = {
        shop_id: 'not-a-valid-uuid',
        items: [{ menu_item_id: validMenuId, qty: 1 }],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, false);
    });

    it('should reject invalid payment method', () => {
      const input = {
        shop_id: validShopId,
        payment_method: 'bitcoin',
        items: [{ menu_item_id: validMenuId, qty: 1 }],
      };

      const result = createOrderSchema.safeParse(input);
      assert.equal(result.success, false);
    });
  });

  describe('Order Lifecycle & Status Transitions', () => {
    it('should allow valid standard status progression', () => {
      assert.equal(isValidOrderStatusTransition('pending', 'confirmed'), true);
      assert.equal(isValidOrderStatusTransition('confirmed', 'cooking'), true);
      assert.equal(isValidOrderStatusTransition('cooking', 'served'), true);
      assert.equal(isValidOrderStatusTransition('served', 'completed'), true);
    });

    it('should allow cancellation from pending and confirmed', () => {
      assert.equal(isValidOrderStatusTransition('pending', 'cancelled'), true);
      assert.equal(isValidOrderStatusTransition('confirmed', 'cancelled'), true);
    });

    it('should disallow invalid transitions (skipping states or reviving cancelled orders)', () => {
      assert.equal(isValidOrderStatusTransition('pending', 'completed'), false);
      assert.equal(isValidOrderStatusTransition('completed', 'cooking'), false);
      assert.equal(isValidOrderStatusTransition('cancelled', 'confirmed'), false);
      assert.equal(isValidOrderStatusTransition('completed', 'cancelled'), false);
    });
  });

  describe('Order Financial Calculations', () => {
    it('should correctly calculate subtotal, service charge, and VAT in exclusive mode', () => {
      // Subtotal = 200, SC = 10% (20), Base for VAT = 220, VAT 7% = 15.4 -> Total = 235.4
      const result = calculateOrderFinancials({
        subtotal: 200,
        serviceChargePercent: 10,
        vatMode: 'exclusive',
      });

      assert.equal(result.subtotal, 200);
      assert.equal(result.serviceCharge, 20);
      assert.equal(result.vat, 15.4);
      assert.equal(result.total, 235.4);
    });

    it('should handle zero service charge and no VAT correctly', () => {
      const result = calculateOrderFinancials({
        subtotal: 150,
        serviceChargePercent: 0,
        vatMode: 'none',
      });

      assert.equal(result.subtotal, 150);
      assert.equal(result.serviceCharge, 0);
      assert.equal(result.vat, 0);
      assert.equal(result.total, 150);
    });
  });
});
