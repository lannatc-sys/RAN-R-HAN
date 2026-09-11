import webpush from 'web-push';
import { sendTelegramMessage, isTelegramConfigured } from './telegram';

// Init VAPID
try {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@ran-r-han.local',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (err) {
  console.warn('[Rider Notification] VAPID initialization skipped or failed:', err);
}

export interface RiderOfferNotificationDetails {
  orderId: string;
  offerId: string;
  orderNo: string | number;
  deliveryAddress: string;
  estimatedDistanceKm: number | null;
  total?: number;
  timeoutSeconds: number;
}

export interface RiderNotificationResult {
  webPushSent: number;
  webPushFailed: number;
  telegramSent: boolean;
  error?: string;
}

/**
 * Format message for Telegram Bot delivery offer to rider
 */
export function formatRiderOfferTelegramMessage(
  orderNo: string | number,
  deliveryAddress: string,
  estimatedDistanceKm: number | null,
  timeoutSeconds: number,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'https://ran-r-han.vercel.app'
): string {
  const distanceStr = estimatedDistanceKm !== null ? `${estimatedDistanceKm.toFixed(1)} กม.` : 'ไม่ระบุ';
  const cleanAddress = deliveryAddress.trim() || 'ตามหมุดแผนที่';

  return (
    `🛵 *มีงานจัดส่งอาหารใหม่!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📦 *เลขออเดอร์:* #${orderNo}\n` +
    `📍 *จุดส่งสินค้า:* ${cleanAddress}\n` +
    `📏 *ระยะทางโดยประมาณ:* ${distanceStr}\n` +
    `⏱️ *เวลาตอบรับ:* ภายใน *${timeoutSeconds}* วินาที\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `👉 [กดที่นี่เพื่อเปิดแอปและรับงาน](${appUrl}/rider)`
  );
}

/**
 * Notify rider about a new dispatch offer via Web Push (primary) and Telegram (fallback/supplementary)
 */
export async function notifyRiderNewOffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  riderId: string,
  details: RiderOfferNotificationDetails
): Promise<RiderNotificationResult> {
  const result: RiderNotificationResult = {
    webPushSent: 0,
    webPushFailed: 0,
    telegramSent: false,
  };

  try {
    // 1. Fetch rider info (auth_user_id, telegram_chat_id, push_enabled)
    const { data: rider, error: riderError } = await adminClient
      .from('riders')
      .select('id, auth_user_id, display_name, phone, telegram_chat_id, push_enabled')
      .eq('id', riderId)
      .maybeSingle();

    if (riderError || !rider) {
      console.warn(`[Rider Notification] Rider not found: ${riderId}`);
      result.error = 'Rider not found';
      return result;
    }

    // Redacted phone for audit log
    const maskedPhone = rider.phone ? `xxx-xxx-${String(rider.phone).slice(-2)}` : 'unknown';
    console.log(
      `[Rider Notification] Dispatching offer ${details.offerId} to rider ${rider.display_name} (${maskedPhone})`
    );

    // 2. Channel 1: Web Push (Primary)
    if (rider.auth_user_id && rider.push_enabled !== false) {
      try {
        const { data: subs, error: subsError } = await adminClient
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .eq('user_id', rider.auth_user_id);

        if (!subsError && subs && subs.length > 0) {
          const pushPayload = JSON.stringify({
            title: '🛵 มีงานจัดส่งอาหารใหม่!',
            body: `ออเดอร์ #${details.orderNo} ตอบรับภายใน ${details.timeoutSeconds} วิ`,
            url: '/rider',
            icon: '/icon-192.png',
            tag: `dispatch-offer-${details.offerId}`,
            data: {
              offerId: details.offerId,
              orderId: details.orderId,
              timeoutSeconds: details.timeoutSeconds,
            },
          });

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
                pushPayload
              );
              result.webPushSent++;
            } catch (err: any) {
              result.webPushFailed++;
              if (err.statusCode === 410 || err.statusCode === 404) {
                expiredIds.push(sub.id);
              }
            }
          }

          if (expiredIds.length > 0) {
            await adminClient.from('push_subscriptions').delete().in('id', expiredIds);
          }
        }
      } catch (pushErr) {
        console.warn('[Rider Notification] Web push attempt failed:', pushErr);
      }
    }

    // 3. Channel 2: Telegram Bot (Fallback / Supplementary)
    // ส่ง Telegram หากมี telegram_chat_id และระบบตั้งค่า Telegram ไว้
    if (rider.telegram_chat_id && isTelegramConfigured()) {
      try {
        const tgText = formatRiderOfferTelegramMessage(
          details.orderNo,
          details.deliveryAddress,
          details.estimatedDistanceKm,
          details.timeoutSeconds
        );

        const tgRes = await sendTelegramMessage(rider.telegram_chat_id, tgText, {
          parse_mode: 'Markdown',
        });

        if (tgRes.success) {
          result.telegramSent = true;
          console.log(`[Rider Notification] Sent Telegram message to rider chat ${rider.telegram_chat_id}`);
        } else {
          console.warn(`[Rider Notification] Telegram message failed: ${tgRes.error}`);
        }
      } catch (tgErr) {
        console.warn('[Rider Notification] Telegram notification attempt failed:', tgErr);
      }
    }

    return result;
  } catch (err: any) {
    console.warn('[Rider Notification] Unexpected error in notifyRiderNewOffer:', err);
    result.error = err.message || 'Notification error';
    return result;
  }
}
