import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptApiKey, decryptApiKey } from '../src/lib/crypto';
import { generatePromptPayQR, normalizePromptPayId } from '../src/lib/promptpay';
import { formatThaiError } from '../src/lib/thai-errors';

describe('💳 Payment & Slip Verification Tests', () => {
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('AES-256-GCM Encryption & Decryption', () => {
    it('should encrypt and decrypt a SlipOK API key idempotently', () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
      const secret = 'slp_live_abc123xyz_super_secret';
      const encrypted = encryptApiKey(secret);
      const decrypted = decryptApiKey(encrypted);

      assert.equal(decrypted, secret);
      assert.notEqual(encrypted.toString('hex'), secret);
    });

    it('should produce different ciphertexts for the same plaintext due to random IV', () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
      const secret = 'identical_plaintext';
      const enc1 = encryptApiKey(secret);
      const enc2 = encryptApiKey(secret);

      assert.notEqual(enc1.toString('hex'), enc2.toString('hex'));
      assert.equal(decryptApiKey(enc1), secret);
      assert.equal(decryptApiKey(enc2), secret);
    });

    it('should fail when decrypting tampered data', () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
      const secret = 'test_secret';
      const encrypted = encryptApiKey(secret);

      const tampered = Buffer.from(encrypted);
      // Flip a bit in the ciphertext / auth tag
      tampered[tampered.length - 1] ^= 0xff;

      assert.throws(() => {
        decryptApiKey(tampered);
      });
    });

    it('should throw if CREDENTIALS_ENCRYPTION_KEY is missing in environment', () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      assert.throws(() => {
        encryptApiKey('secret');
      }, /CREDENTIALS_ENCRYPTION_KEY is not defined/);
      // Restore
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
    });
  });

  describe('PromptPay Normalization & QR Generation', () => {
    it('should normalize mobile numbers with dashes and spaces', () => {
      assert.equal(normalizePromptPayId('081-234-5678'), '0812345678');
      assert.equal(normalizePromptPayId(' 089 999 1234 '), '0899991234');
    });

    it('should normalize Tax IDs with dashes', () => {
      assert.equal(normalizePromptPayId('0-1055-61008-72-9'), '0105561008729');
    });

    it('should generate a QR code data URL successfully for valid phone and amount', async () => {
      const qrDataUrl = await generatePromptPayQR('0812345678', 250.50);
      assert.ok(qrDataUrl.startsWith('data:image/png;base64,'));
    });

    it('should generate a QR code data URL for 0 amount (generic payment QR)', async () => {
      const qrDataUrl = await generatePromptPayQR('0812345678', 0);
      assert.ok(qrDataUrl.startsWith('data:image/png;base64,'));
    });

    it('should reject invalid promptpay IDs with less than 10 digits', async () => {
      await assert.rejects(async () => {
        await generatePromptPayQR('12345', 100);
      }, /INVALID_PROMPTPAY_ID/);
    });
  });

  describe('Thai Error Formatting (Slip & Payment Cases)', () => {
    it('should identify code 23505 as duplicate slip', () => {
      const error = { code: '23505', message: 'duplicate key value violates unique constraint payments_trans_ref_uq' };
      const formatted = formatThaiError(error);
      assert.ok(formatted.includes('สลิปนี้ถูกใช้งานไปแล้ว'));
    });

    it('should handle ORDER_LOCKED error correctly', () => {
      const error = new Error('ORDER_LOCKED: บิลนี้อยู่ระหว่างการชำระเงิน');
      const formatted = formatThaiError(error);
      assert.ok(formatted.includes('กำลังถูกประมวลผลอยู่'));
    });

    it('should map MENU_NOT_AVAILABLE to Thai error message', () => {
      const error = new Error('MENU_NOT_AVAILABLE');
      const formatted = formatThaiError(error);
      assert.ok(formatted.includes('รายการอาหารบางอย่างหมดชั่วคราว'));
    });
  });
});
