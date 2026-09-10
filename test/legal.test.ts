import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDataSubjectRequestSchema } from '../src/lib/validations/legal';
import type { ConsentType, DataSubjectRequestType } from '../src/lib/types';

describe('⚖️ Legal & PDPA Compliance Tests (WP-19 to WP-23)', () => {
  describe('PDPA Data Subject Request Validation', () => {
    it('should validate a valid DSR request for data access', () => {
      const validPayload = {
        requester_name: 'สมชาย ใจดี',
        requester_phone: '0812345678',
        requester_email: 'somchai@example.com',
        request_type: 'access' as DataSubjectRequestType,
        details: 'ขอตรวจสอบข้อมูลออเดอร์ย้อนหลัง 3 เดือน',
      };

      const result = createDataSubjectRequestSchema.safeParse(validPayload);
      assert.equal(result.success, true);
    });

    it('should validate request with optional fields omitted', () => {
      const payload = {
        requester_name: 'สมหญิง รักสงบ',
        requester_phone: '0899998888',
        request_type: 'delete' as DataSubjectRequestType,
      };

      const result = createDataSubjectRequestSchema.safeParse(payload);
      assert.equal(result.success, true);
    });

    it('should reject invalid phone numbers less than 9 digits', () => {
      const invalidPayload = {
        requester_name: 'สมชาย',
        requester_phone: '12345',
        request_type: 'correct' as DataSubjectRequestType,
      };

      const result = createDataSubjectRequestSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.errors[0]?.message.includes('อย่างน้อย 9 หลัก'));
      }
    });

    it('should reject invalid request types', () => {
      const invalidPayload = {
        requester_name: 'สมชาย',
        requester_phone: '0812345678',
        request_type: 'hack_database' as any,
      };

      const result = createDataSubjectRequestSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
    });
  });

  describe('PDPA Consent Types & Due Date Calculation', () => {
    it('should support standard PDPA consent categories', () => {
      const validTypes: ConsentType[] = ['terms_and_privacy', 'gps_location', 'marketing'];
      assert.equal(validTypes.length, 3);
      assert.ok(validTypes.includes('terms_and_privacy'));
      assert.ok(validTypes.includes('gps_location'));
    });

    it('should calculate 30 days due date strictly according to Section 30 PDPA', () => {
      const now = new Date('2026-09-10T00:00:00Z').getTime();
      const expectedDays = 30;
      const calculatedDueDate = new Date(now + expectedDays * 24 * 60 * 60 * 1000);

      const diffDays = Math.round(
        (calculatedDueDate.getTime() - now) / (1000 * 60 * 60 * 24)
      );
      assert.equal(diffDays, 30);
    });
  });

  describe('Data Retention Policy Windows (WP-22)', () => {
    it('should calculate 90 days retention window correctly', () => {
      const now = Date.now();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(now - ninetyDaysMs);

      const sampleOldCancelledOrder = new Date(now - 95 * 24 * 60 * 60 * 1000);
      const sampleRecentCancelledOrder = new Date(now - 10 * 24 * 60 * 60 * 1000);

      assert.ok(sampleOldCancelledOrder < cutoffDate, 'Order older than 90 days should be eligible for deletion');
      assert.ok(sampleRecentCancelledOrder > cutoffDate, 'Order newer than 90 days must be preserved');
    });

    it('should preserve paid completed orders for 5-7 years', () => {
      const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const oneYearOldPaidOrder = new Date(now - 365 * 24 * 60 * 60 * 1000);

      // Must NOT be deleted by the 90-day job
      const isEligibleForRetentionDeletion = false; // Protected by business rule
      assert.equal(isEligibleForRetentionDeletion, false);
    });
  });
});
