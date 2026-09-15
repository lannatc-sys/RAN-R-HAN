/**
 * Verified-only Telegram routing (operational gateway).
 *
 * Raw chat ids (operator-typed riders.telegram_chat_id, per-order customer
 * ids) are never used for shop/rider/admin routing. Every recipient is
 * resolved through telegram_identities: exactly one verified user per
 * Telegram account, revoked links resolve to nothing and are skipped.
 */
import { sendTelegramMessage, type SendTelegramOptions } from './telegram';

type AdminClient = {
  from: (table: string) => any;
};

/** Active verified Telegram account for a user, or null. Fail-closed on error. */
export async function getVerifiedChatForUser(
  admin: AdminClient,
  userId: string
): Promise<number | null> {
  try {
    const { data } = await admin
      .from('telegram_identities')
      .select('telegram_user_id')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .maybeSingle();
    return data ? Number(data.telegram_user_id) : null;
  } catch {
    return null;
  }
}

/**
 * Verified accounts holding this shop right now: legacy users.shop_id row
 * plus active shop_members rows. Superadmins are intentionally excluded —
 * they receive system alerts through the superadmin channel instead of
 * every shop's operational noise.
 */
export async function getVerifiedChatsForShop(
  admin: AdminClient,
  shopId: string
): Promise<number[]> {
  try {
    const { data: legacy } = await admin
      .from('users')
      .select('id')
      .eq('shop_id', shopId);
  const { data: members } = await admin
    .from('shop_members')
    .select('user_id')
    .eq('shop_id', shopId)
    .eq('is_active', true);
  const userIds = new Set<string>([
    ...((legacy ?? []).map((u: any) => String(u.id))),
    ...((members ?? []).map((m: any) => String(m.user_id))),
  ]);
  if (userIds.size === 0) return [];
    const { data: links } = await admin
      .from('telegram_identities')
      .select('telegram_user_id')
      .in('user_id', [...userIds])
      .is('revoked_at', null);
    return (links ?? []).map((l: any) => Number(l.telegram_user_id));
  } catch {
    return [];
  }
}

/** Verified account owning a rider identity (via riders.auth_user_id). */
export async function getVerifiedChatForRider(
  admin: AdminClient,
  riderId: string
): Promise<number | null> {
  try {
    const { data: rider } = await admin
      .from('riders')
      .select('auth_user_id')
      .eq('id', riderId)
      .maybeSingle();
    if (!rider?.auth_user_id) return null;
    return getVerifiedChatForUser(admin, String(rider.auth_user_id));
  } catch {
    return null;
  }
}

/** Verified accounts of all superadmins (admin-scope alerts). */
export async function getVerifiedChatsForSuperadmins(
  admin: AdminClient
): Promise<number[]> {
  try {
    const { data: admins } = await admin.from('users').select('id').eq('role', 'superadmin');
    if (!admins || admins.length === 0) return [];
    const { data: links } = await admin
      .from('telegram_identities')
      .select('telegram_user_id')
      .in(
        'user_id',
        admins.map((a: any) => String(a.id))
      )
      .is('revoked_at', null);
    return (links ?? []).map((l: any) => Number(l.telegram_user_id));
  } catch {
    return [];
  }
}

function maskChat(chat: number | string): string {
  const s = String(chat);
  return s.length <= 4 ? '****' : `${'*'.repeat(s.length - 4)}${s.slice(-4)}`;
}

/** Send to explicit verified chats only. Returns delivered count. */
export async function sendToVerifiedChats(
  chats: Array<number | string>,
  text: string,
  options?: SendTelegramOptions
): Promise<{ delivered: number }> {
  let delivered = 0;
  for (const chat of chats) {
    try {
      const res = await sendTelegramMessage(chat, text, options);
      if (res.success) delivered++;
      else console.warn(`[tg-routing] send failed to ${maskChat(chat)}: ${res.error}`);
    } catch (err: any) {
      console.warn(`[tg-routing] send error to ${maskChat(chat)}: ${err?.message}`);
    }
  }
  return { delivered };
}

/** F.1 Order/shop notification: only verified holders of this shop. */
export async function notifyShopUsers(
  admin: AdminClient,
  shopId: string,
  text: string,
  options?: SendTelegramOptions
): Promise<{ delivered: number }> {
  const chats = await getVerifiedChatsForShop(admin, shopId);
  if (chats.length === 0) return { delivered: 0 };
  return sendToVerifiedChats(chats, text, options);
}

/** F.2 Rider offer: only the verified account owning this rider. */
export async function notifyRiderOwner(
  admin: AdminClient,
  riderId: string,
  text: string,
  options?: SendTelegramOptions
): Promise<{ delivered: number }> {
  const chat = await getVerifiedChatForRider(admin, riderId);
  if (!chat) return { delivered: 0 };
  return sendToVerifiedChats([chat], text, options);
}
