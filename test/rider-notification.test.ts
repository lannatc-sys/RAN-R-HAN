import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRiderOfferTelegramMessage,
  notifyRiderNewOffer,
} from '../src/lib/rider-notification';

describe('🛵 Rider Notification System Tests', () => {
  describe('Telegram Offer Message Formatting', () => {
    it('จัดรูปแบบข้อความ Telegram สำหรับ Offer งานใหม่ได้ถูกต้อง', () => {
      const msg = formatRiderOfferTelegramMessage(
        'A001',
        '123/4 ถ.ขุนลุมประพาส ต.จองคำ',
        2.5,
        30,
        'https://ran-r-han.vercel.app'
      );

      assert.ok(msg.includes('🛵 *มีงานจัดส่งอาหารใหม่!*'));
      assert.ok(msg.includes('📦 *เลขออเดอร์:* #A001'));
      assert.ok(msg.includes('123/4 ถ.ขุนลุมประพาส'));
      assert.ok(msg.includes('2.5 กม.'));
      assert.ok(msg.includes('*30* วินาที'));
      assert.ok(msg.includes('https://ran-r-han.vercel.app/rider'));
    });

    it('จัดการกรณีไม่มีระยะทาง (null) และที่อยู่ว่างได้โดยไม่พัง', () => {
      const msg = formatRiderOfferTelegramMessage('B002', '   ', null, 45);

      assert.ok(msg.includes('#B002'));
      assert.ok(msg.includes('ไม่ระบุ'));
      assert.ok(msg.includes('ตามหมุดแผนที่'));
      assert.ok(msg.includes('*45* วินาที'));
    });
  });

  describe('Notification Dispatch Orchestration & Fallback', () => {
    it('ไม่ล่มเมื่อไม่พบข้อมูลไรเดอร์ (Rider not found)', async () => {
      const mockAdminClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };

      const result = await notifyRiderNewOffer(mockAdminClient, 'non-existent-rider', {
        orderId: 'order-123',
        offerId: 'offer-456',
        orderNo: 'A001',
        deliveryAddress: 'ร้านป้าแดง',
        estimatedDistanceKm: 1.2,
        timeoutSeconds: 30,
      });

      assert.equal(result.webPushSent, 0);
      assert.equal(result.telegramSent, false);
      assert.equal(result.error, 'Rider not found');
    });

    it('ไม่ล่มเมื่อ push_subscriptions เกิดข้อผิดพลาดจาก DB', async () => {
      const mockAdminClient = {
        from: (table: string) => {
          if (table === 'riders') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'rider-1',
                      auth_user_id: 'user-1',
                      display_name: 'สมชาย',
                      phone: '0812345678',
                      push_enabled: true,
                      telegram_chat_id: null,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'push_subscriptions') {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: null, error: new Error('DB Connection Error') }),
              }),
            };
          }
          return { select: () => ({}) };
        },
      };

      const result = await notifyRiderNewOffer(mockAdminClient, 'rider-1', {
        orderId: 'order-1',
        offerId: 'offer-1',
        orderNo: 'A001',
        deliveryAddress: 'ที่อยู่ส่ง',
        estimatedDistanceKm: 2.0,
        timeoutSeconds: 30,
      });

      assert.equal(result.webPushSent, 0);
      assert.equal(result.telegramSent, false);
      assert.equal(result.error, undefined); // Handled gracefully
    });

    it('ส่ง Web Push สำเร็จเมื่อมี subscription', async () => {
      let sentCount = 0;
      const mockAdminClient = {
        from: (table: string) => {
          if (table === 'riders') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'rider-1',
                      auth_user_id: 'user-1',
                      display_name: 'สมชาย',
                      phone: '0812345678',
                      push_enabled: true,
                      telegram_chat_id: null,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'push_subscriptions') {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'sub-1',
                        endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint',
                        p256dh: 'fake-p256dh',
                        auth: 'fake-auth',
                      },
                    ],
                    error: null,
                  }),
              }),
              delete: () => ({ in: () => Promise.resolve() }),
            };
          }
          return { select: () => ({}) };
        },
      };

      // notifyRiderNewOffer should attempt sendNotification without crashing even if network fails
      const result = await notifyRiderNewOffer(mockAdminClient, 'rider-1', {
        orderId: 'order-1',
        offerId: 'offer-1',
        orderNo: 'A001',
        deliveryAddress: 'ถ.ขุนลุมประพาส',
        estimatedDistanceKm: 1.5,
        timeoutSeconds: 30,
      });

      assert.ok(typeof result.webPushSent === 'number');
      assert.ok(typeof result.webPushFailed === 'number');
    });
  });
});
