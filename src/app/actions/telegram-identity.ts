'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  getTelegramBotUsername,
  isTelegramConfigured,
  sendTelegramMessage,
} from '@/lib/telegram';
import {
  resolveTelegramIdentity,
  type ResolvedTelegramIdentity,
} from '@/lib/telegram-identity';

const VERIFY_DEEP_LINK_TTL_MINUTES = 10;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Step 1 of verify-first: a logged-in user mints a short-lived one-time
 * token and opens the t.me deep link from their own Telegram account.
 * The token alone links nothing — binding happens in confirm step below.
 */
export async function requestTelegramVerifyAction(): Promise<{
  success: boolean;
  botUrl?: string;
  expiresAt?: string;
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (!user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนเชื่อม Telegram' };
    if (!isTelegramConfigured()) {
      return { success: false, error: 'ระบบยังไม่ได้ตั้งค่า Telegram Bot' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('telegram_verify_tokens')
      .insert({
        user_id: user.id,
        expires_at: new Date(Date.now() + VERIFY_DEEP_LINK_TTL_MINUTES * 60 * 1000).toISOString(),
        used: false,
      })
      .select('token, expires_at')
      .single();
    if (error || !data) {
      console.error('requestTelegramVerifyAction db error:', error);
      return { success: false, error: 'สร้างลิงก์ยืนยันไม่สำเร็จ' };
    }

    return {
      success: true,
      botUrl: `https://t.me/${getTelegramBotUsername()}?start=${data.token}`,
      expiresAt: data.expires_at,
    };
  } catch (err: any) {
    console.error('requestTelegramVerifyAction error:', err);
    return { success: false, error: 'สร้างลิงก์ยืนยันไม่สำเร็จ' };
  }
}

/**
 * Step 3 of verify-first: still logged in, the user confirms the Telegram
 * account that opened the deep link. The token must belong to this user,
 * carry a telegram_user_id recorded from /start, be unexpired and unused.
 */
export async function confirmTelegramLinkAction(token: string): Promise<{
  success: boolean;
  identity?: Pick<ResolvedTelegramIdentity, 'user_id' | 'role' | 'verified_at'> & {
    shops: number;
    riders: number;
  };
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (!user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนยืนยัน' };
    const clean = String(token || '').trim();
    if (!clean) return { success: false, error: 'ลิงก์ยืนยันไม่ถูกต้อง' };

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from('telegram_verify_tokens')
      .select('token, user_id, telegram_user_id, expires_at, used')
      .eq('token', clean)
      .maybeSingle();
    if (error || !row) return { success: false, error: 'ไม่พบลิงก์ยืนยันนี้' };
    if (row.user_id !== user.id) {
      return { success: false, error: 'ลิงก์นี้ไม่ใช่ของคุณ' };
    }
    if (row.used) return { success: false, error: 'ลิงก์นี้ถูกใช้ไปแล้ว' };
    if (new Date(row.expires_at) < new Date()) {
      return { success: false, error: 'ลิงก์หมดอายุแล้ว กรุณาสร้างใหม่' };
    }
    if (!row.telegram_user_id) {
      return {
        success: false,
        error: 'ยังไม่พบการเปิดลิงก์จาก Telegram กรุณากดลิงก์ในแอป Telegram ก่อน',
      };
    }

    // Guard: this Telegram account must not be actively linked to someone else.
    const { data: taken } = await admin
      .from('telegram_identities')
      .select('user_id')
      .eq('telegram_user_id', row.telegram_user_id)
      .is('revoked_at', null)
      .maybeSingle();
    if (taken && taken.user_id !== user.id) {
      return { success: false, error: 'บัญชี Telegram นี้ถูกผูกกับผู้ใช้อื่นแล้ว' };
    }

    // Guard: one active link per user — unlink first instead of silently replacing.
    const { data: mine } = await admin
      .from('telegram_identities')
      .select('telegram_user_id')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .maybeSingle();
    if (mine && Number(mine.telegram_user_id) !== Number(row.telegram_user_id)) {
      return { success: false, error: 'คุณผูก Telegram อื่นไว้แล้ว กรุณายกเลิกอันเดิมก่อน' };
    }

    const { error: upsertError } = await admin.from('telegram_identities').upsert(
      {
        telegram_user_id: row.telegram_user_id,
        user_id: user.id,
        verified_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'telegram_user_id' }
    );
    if (upsertError) {
      console.error('confirmTelegramLinkAction upsert error:', upsertError);
      return { success: false, error: 'ยืนยันตัวตนไม่สำเร็จ' };
    }

    await admin
      .from('telegram_verify_tokens')
      .update({ used: true })
      .eq('token', clean);

    const identity = await resolveTelegramIdentity(admin, row.telegram_user_id);

    if (isTelegramConfigured() && row.telegram_user_id) {
      await sendTelegramMessage(
        row.telegram_user_id,
        `✅ *ยืนยันตัวตนสำเร็จ!*\n\nบัญชี Telegram นี้ผูกกับระบบ RAN-R-HAN แล้ว พิมพ์ /menu เพื่อดูเมนูตามสิทธิ์ของคุณค่ะ`,
        { parse_mode: 'Markdown' }
      );
    }

    return {
      success: true,
      identity: identity
        ? {
            user_id: identity.user_id,
            role: identity.role,
            verified_at: identity.verified_at,
            shops: identity.shops.length,
            riders: identity.riders.length,
          }
        : undefined,
    };
  } catch (err: any) {
    console.error('confirmTelegramLinkAction error:', err);
    return { success: false, error: 'ยืนยันตัวตนไม่สำเร็จ' };
  }
}

/** Revoke my Telegram link(s). Revoked accounts resolve to null everywhere. */
export async function unlinkTelegramAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (!user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อน' };

    const admin = createAdminClient();
    const { error } = await admin
      .from('telegram_identities')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('revoked_at', null);
    if (error) {
      console.error('unlinkTelegramAction db error:', error);
      return { success: false, error: 'ยกเลิกการผูกไม่สำเร็จ' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('unlinkTelegramAction error:', err);
    return { success: false, error: 'ยกเลิกการผูกไม่สำเร็จ' };
  }
}

/** My verified identity + roles/memberships ( powers "My account" ). */
export async function getMyTelegramStatusAction(): Promise<{
  success: boolean;
  identity?: ResolvedTelegramIdentity;
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (!user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อน' };

    const admin = createAdminClient();
    const { data: link } = await admin
      .from('telegram_identities')
      .select('telegram_user_id')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .maybeSingle();
    if (!link) return { success: true, identity: undefined };

    const identity = await resolveTelegramIdentity(admin, link.telegram_user_id);
    return { success: true, identity: identity ?? undefined };
  } catch (err: any) {
    console.error('getMyTelegramStatusAction error:', err);
    return { success: false, error: 'โหลดสถานะไม่สำเร็จ' };
  }
}
