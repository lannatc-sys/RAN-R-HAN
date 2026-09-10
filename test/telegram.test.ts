import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  formatOrderStatusText,
  getTelegramBotUsername,
  isTelegramConfigured,
  sendTelegramMessage,
} from '../src/lib/telegram';

describe('🤖 Telegram Bot & Notifications Tests', () => {
  describe('Status Message Formatting (Thai & English)', () => {
    const shopName = 'ครัวป้าแดง';
    const orderNo = '42';

    test('should format Thai message for confirmed status', () => {
      const msg = formatOrderStatusText('confirmed', orderNo, shopName, 'th');
      assert.match(msg, /ครัวป้าแดง/);
      assert.match(msg, /#0042/);
      assert.match(msg, /รับออเดอร์/);
    });

    test('should format Thai message for cooking status', () => {
      const msg = formatOrderStatusText('cooking', orderNo, shopName, 'th');
      assert.match(msg, /กำลังปรุงอาหาร/);
      assert.match(msg, /#0042/);
    });

    test('should format Thai message for served status', () => {
      const msg = formatOrderStatusText('served', orderNo, shopName, 'th');
      assert.match(msg, /อาหารเสร็จแล้วพร้อมรับ/);
      assert.match(msg, /#0042/);
    });

    test('should format Thai message for completed status', () => {
      const msg = formatOrderStatusText('completed', orderNo, shopName, 'th');
      assert.match(msg, /เสร็จสมบูรณ์/);
      assert.match(msg, /ขอบคุณที่อุดหนุน/);
    });

    test('should format Thai message for cancelled status', () => {
      const msg = formatOrderStatusText('cancelled', orderNo, shopName, 'th');
      assert.match(msg, /ถูกยกเลิก/);
    });

    test('should format English message for confirmed status', () => {
      const msg = formatOrderStatusText('confirmed', orderNo, shopName, 'en');
      assert.match(msg, /confirmed order #0042/);
    });

    test('should format English message for served status', () => {
      const msg = formatOrderStatusText('served', orderNo, shopName, 'en');
      assert.match(msg, /Order Ready for Pickup/);
    });
  });

  describe('Bot Configuration & Username', () => {
    test('should recognize telegram bot configuration', () => {
      const configured = isTelegramConfigured();
      assert.strictEqual(typeof configured, 'boolean');
    });

    test('should return bot username (ranrhan_bot default or env)', () => {
      const username = getTelegramBotUsername();
      assert.strictEqual(typeof username, 'string');
      assert.ok(username.length > 0);
    });
  });

  describe('Token Expiration Window Calculation', () => {
    test('should calculate 15-minute expiration timestamp correctly', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 15 * 60 * 1000);
      const diffMinutes = (expiresAt.getTime() - now) / (60 * 1000);
      assert.strictEqual(Math.round(diffMinutes), 15);
    });

    test('should correctly identify expired token vs active token', () => {
      const pastToken = { expires_at: new Date(Date.now() - 1000).toISOString(), used: false };
      const activeToken = { expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), used: false };
      const usedToken = { expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), used: true };

      const isPastValid = new Date(pastToken.expires_at) > new Date() && !pastToken.used;
      const isActiveValid = new Date(activeToken.expires_at) > new Date() && !activeToken.used;
      const isUsedValid = new Date(usedToken.expires_at) > new Date() && !usedToken.used;

      assert.strictEqual(isPastValid, false);
      assert.strictEqual(isActiveValid, true);
      assert.strictEqual(isUsedValid, false);
    });
  });

  describe('API Safe Error Handling', () => {
    test('should handle empty or whitespace chatId safely without crashing', async () => {
      const result = await sendTelegramMessage('   ', 'Hello');
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });
});
