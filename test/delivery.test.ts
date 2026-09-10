import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFacebookComment,
  parseBulkComments,
  groupTripItemsByLocation,
} from '../src/lib/delivery-parser';
import {
  createLocationSchema,
  createTripSchema,
  createPreorderRoundSchema,
} from '../src/lib/validations/delivery';
import type { DeliveryLocation, DeliveryTripItem } from '../src/lib/types';

describe('🚚 Delivery & Preorder System Tests', () => {
  const mockLocations: DeliveryLocation[] = [
    {
      id: 'loc-1',
      shop_id: null,
      name: 'กาดเทศบาลเมืองแม่ฮ่องสอน',
      zone_name: 'เขตเทศบาลเมืองแม่ฮ่องสอน',
      lat: 19.3005,
      lng: 97.9678,
      sort_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'loc-2',
      shop_id: null,
      name: 'หน้าโรงพยาบาลศรีสังวาลย์',
      zone_name: 'เขตเทศบาลเมืองแม่ฮ่องสอน',
      lat: 19.3028,
      lng: 97.9634,
      sort_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'loc-3',
      shop_id: null,
      name: 'สวนสาธารณะหนองจองคำ',
      zone_name: 'เขตเทศบาลเมืองแม่ฮ่องสอน',
      lat: 19.2990,
      lng: 97.9692,
      sort_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  describe('Facebook Comment Parser (Single & Bulk)', () => {
    it('should parse phone, matched location, name, and items from Thai comment', () => {
      const comment = 'สมชาย 081-234-5678 รับหน้าโรงพยาบาลศรีสังวาลย์ ข้าวหมูกรอบ 2 กล่อง ข้างตู้ ATM';
      const parsed = parseFacebookComment(comment, mockLocations);

      assert.equal(parsed.recipient_phone, '0812345678');
      assert.equal(parsed.location_id, 'loc-2');
      assert.equal(parsed.location_name, 'หน้าโรงพยาบาลศรีสังวาลย์');
      assert.ok(parsed.recipient_name.includes('สมชาย'));
      assert.ok(parsed.items_summary.includes('ข้าวหมูกรอบ'));
    });

    it('should fallback to default or unmatched location when location is not in text', () => {
      const comment = 'ป้าพร 0899991122 แคบหมู 3 ถุง';
      const parsed = parseFacebookComment(comment, mockLocations);

      assert.equal(parsed.recipient_phone, '0899991122');
      assert.equal(parsed.location_id, null);
      assert.ok(parsed.recipient_name.includes('ป้าพร'));
      assert.ok(parsed.items_summary.includes('แคบหมู'));
    });

    it('should parse multiple comments separated by newlines', () => {
      const rawText = `
        วรรณา 0861112233 ไส้อั่ว 1 โล กาดเทศบาลเมืองแม่ฮ่องสอน
        ลุงสม 0874445566 ลาบหมู 2 หนองจองคำ
      `;
      const parsedList = parseBulkComments(rawText, mockLocations);

      assert.equal(parsedList.length, 2);
      assert.equal(parsedList[0].recipient_phone, '0861112233');
      assert.equal(parsedList[0].location_id, 'loc-1');
      assert.equal(parsedList[1].recipient_phone, '0874445566');
      assert.equal(parsedList[1].location_id, 'loc-3');
    });
  });

  describe('Delivery Trip Items Grouping for Map Visualization', () => {
    it('should group items by location and count total recipients', () => {
      const items: DeliveryTripItem[] = [
        {
          id: 'item-1',
          trip_id: 'trip-1',
          location_id: 'loc-1',
          recipient_name: 'สมศรี',
          recipient_phone: '0811111111',
          location_note: null,
          items_summary: 'ข้าวผัด 1',
          order_reference_id: null,
          delivery_status: 'pending',
          delivered_at: null,
          created_at: new Date().toISOString(),
          location: mockLocations[0],
        },
        {
          id: 'item-2',
          trip_id: 'trip-1',
          location_id: 'loc-1',
          recipient_name: 'สมชาย',
          recipient_phone: '0822222222',
          location_note: null,
          items_summary: 'ผัดกะเพรา 2',
          order_reference_id: null,
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          location: mockLocations[0],
        },
        {
          id: 'item-3',
          trip_id: 'trip-1',
          location_id: 'loc-2',
          recipient_name: 'วิภา',
          recipient_phone: '0833333333',
          location_note: 'หน้าลิฟต์',
          items_summary: 'ต้มยำ 1',
          order_reference_id: null,
          delivery_status: 'pending',
          delivered_at: null,
          created_at: new Date().toISOString(),
          location: mockLocations[1],
        },
      ];

      const grouped = groupTripItemsByLocation(items);

      assert.equal(grouped.length, 2);
      const loc1Group = grouped.find(g => g.locationId === 'loc-1');
      const loc2Group = grouped.find(g => g.locationId === 'loc-2');

      assert.ok(loc1Group);
      assert.equal(loc1Group?.items.length, 2);
      assert.equal(loc1Group?.deliveredCount, 1);
      assert.equal(loc1Group?.pendingCount, 1);

      assert.ok(loc2Group);
      assert.equal(loc2Group?.items.length, 1);
      assert.equal(loc2Group?.deliveredCount, 0);
      assert.equal(loc2Group?.pendingCount, 1);
    });
  });

  describe('Delivery Zod Validations', () => {
    it('should validate a valid delivery location', () => {
      const input = {
        name: 'สี่แยกไปรษณีย์แม่ฮ่องสอน',
        lat: 19.3001,
        lng: 97.9649,
      };
      const res = createLocationSchema.safeParse(input);
      assert.equal(res.success, true);
    });

    it('should validate a valid delivery trip', () => {
      const input = {
        shop_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        trip_name: 'รอบส่งช่วงบ่าย 14:00 น.',
        trip_date: '2026-09-10',
      };
      const res = createTripSchema.safeParse(input);
      assert.equal(res.success, true);
    });

    it('should validate a valid preorder round', () => {
      const input = {
        shop_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: 'เปิดจองออเดอร์วันศุกร์เสาร์',
        cutoff_at: '2026-09-11T12:00:00Z',
        delivery_date: '2026-09-12',
      };
      const res = createPreorderRoundSchema.safeParse(input);
      assert.equal(res.success, true);
    });
  });
});
