import webpush from 'web-push';
import { createAdminClient } from './supabase/admin';

// กำหนด VAPID Details
try {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@rab-r-han.local',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (err) {
  console.warn('VAPID initialization skipped or failed:', err);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  orderId?: string;
  orderNo?: string;
}

/**
 * ส่ง Web Push Notification ไปยังเครื่องของ Staff และ Owner ทุกคนในร้านค้านั้นๆ
 */
export async function sendPushToShop(
  shopId: string,
  payload: PushNotificationPayload
): Promise<{ total: number; sent: number; failed: number }> {
  const admin = createAdminClient();

  // ดึง subscriptions ของร้านนี้
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('shop_id', shopId);

  if (error || !subs || subs.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  const notificationString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || `/admin/orders?highlight=${payload.orderId || ''}`,
    icon: payload.icon || '/icon-192.png',
    data: {
      orderId: payload.orderId,
      orderNo: payload.orderNo,
    },
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        notificationString
      );
      sent++;
    } catch (err: any) {
      failed++;
      // หาก Subscription หมดอายุหรือไม่สามารถส่งได้แล้ว (410 Gone / 404 Not Found)
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredIds.push(sub.id);
      }
    }
  }

  // ลบ subscriptions ที่หมดอายุแล้วออกจาก DB
  if (expiredIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return { total: subs.length, sent, failed };
}
