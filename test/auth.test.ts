import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRegisterInput,
  isSupportAccessActive,
  isSuperadminUser,
} from '../src/lib/auth-helpers';

describe('🔐 Auth & Security Tests', () => {
  describe('Registration Input Validation', () => {
    it('should accept valid registration input', () => {
      const input = {
        shop_name: 'ร้านข้าวมันไก่เฮงเฮง',
        first_name: 'สมเกียรติ',
        last_name: 'มีสุข',
        phone: '081-234-5678',
        email: 'somkiat@example.com',
        password: 'password123',
      };

      const result = validateRegisterInput(input);
      assert.equal(result.isValid, true);
      assert.equal(result.cleanPhone, '0812345678');
      assert.equal(result.cleanEmail, 'somkiat@example.com');
    });

    it('should reject missing required fields', () => {
      const input = {
        shop_name: '',
        first_name: 'สมเกียรติ',
        last_name: '',
        phone: '0812345678',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = validateRegisterInput(input);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('กรุณากรอกข้อมูลให้ครบ'));
    });

    it('should reject password less than 6 characters', () => {
      const input = {
        shop_name: 'ร้านค้า',
        first_name: 'ชื่อ',
        last_name: 'สกุล',
        phone: '0812345678',
        email: 'test@example.com',
        password: '12345',
      };

      const result = validateRegisterInput(input);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('6 ตัวอักษร'));
    });

    it('should reject invalid phone numbers (< 9 or > 10 digits)', () => {
      const shortPhone = {
        shop_name: 'ร้านค้า',
        first_name: 'ชื่อ',
        last_name: 'สกุล',
        phone: '08123',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = validateRegisterInput(shortPhone);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('9-10 หลัก'));
    });
  });

  describe('Superadmin Role Check', () => {
    it('should identify superadmin email correctly', () => {
      process.env.SUPER_ADMIN_USER = 'admin@ran-r-han.com';

      assert.equal(isSuperadminUser('admin@ran-r-han.com'), true);
      assert.equal(isSuperadminUser('ADMIN@RAN-R-HAN.COM'), true); // case-insensitive
      assert.equal(isSuperadminUser('user@example.com'), false);
      assert.equal(isSuperadminUser(null), false);
      assert.equal(isSuperadminUser(undefined), false);
    });
  });

  describe('Support Access Expiration Check', () => {
    it('should return true for a valid future expiry date', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      assert.equal(isSupportAccessActive(futureDate), true);
    });

    it('should return false for an expired past date or null', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      assert.equal(isSupportAccessActive(pastDate), false);
      assert.equal(isSupportAccessActive(null), false);
      assert.equal(isSupportAccessActive(undefined as any), false);
    });
  });
});
