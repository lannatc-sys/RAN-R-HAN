'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { checkIsSuperadmin } from '@/app/actions/superadmin';
import { maskDigits, sendTelegramMessage } from '@/lib/telegram';

export interface ManagedTelegramIdentity {
  telegram_user_id: number;
  user_id: string;
  full_name: string | null;
  phone_masked: string;
  role: string;
  shops: { shop_id: string; shop_name: string; role: string }[];
  riders: { rider_id: string; display_name: string; shop_name: string }[];
  verified_at: string;
  revoked_at: string | null;
}

async function requireSuperadmin() {
  const { isSuperadmin } = await checkIsSuperadmin();
  return isSuperadmin;
}

/** List verified Telegram identities with resolved memberships. */
export async function listTelegramIdentitiesAction(): Promise<{
  success: boolean;
  rows?: ManagedTelegramIdentity[];
  error?: string;
}> {
  try {
    if (!(await requireSuperadmin())) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }
    const admin = createAdminClient();
    const { data: links, error } = await admin
      .from('telegram_identities')
      .select('telegram_user_id, user_id, verified_at, revoked_at')
      .order('verified_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('listTelegramIdentitiesAction db error:', error);
      return { success: false, error: 'โหลดรายการไม่สำเร็จ' };
    }
    if (!links || links.length === 0) return { success: true, rows: [] };

    const userIds = [...new Set(links.map((l: any) => String(l.user_id)))];
    const { data: users } = await admin
      .from('users')
      .select('id, shop_id, role, full_name, phone')
      .in('id', userIds);
    const userById = new Map((users ?? []).map((u: any) => [String(u.id), u]));

    const { data: members } = await admin
      .from('shop_members')
      .select('user_id, shop_id, role')
      .in('user_id', userIds)
      .eq('is_active', true);

    const shopIds = new Set<string>();
    for (const u of users ?? []) if (u.shop_id) shopIds.add(String(u.shop_id));
    for (const m of members ?? []) shopIds.add(String(m.shop_id));
    const { data: shops } = shopIds.size
      ? await admin.from('shops').select('id, name').in('id', [...shopIds])
      : { data: [] };
    const shopName = new Map((shops ?? []).map((s: any) => [String(s.id), String(s.name ?? 'ร้านค้า')]));

    const { data: riders } = await admin
      .from('riders')
      .select('id, shop_id, display_name, auth_user_id')
      .in('auth_user_id', userIds);

    const rows: ManagedTelegramIdentity[] = links.map((l: any) => {
      const u = userById.get(String(l.user_id));
      const myMembers = (members ?? []).filter((m: any) => String(m.user_id) === String(l.user_id));
      const shopList: ManagedTelegramIdentity['shops'] = [];
      if (u?.shop_id) {
        shopList.push({
          shop_id: String(u.shop_id),
          shop_name: shopName.get(String(u.shop_id)) ?? 'ร้านค้า',
          role: String(u.role),
        });
      }
      for (const m of myMembers) {
        if (shopList.some((s) => s.shop_id === String(m.shop_id))) continue;
        shopList.push({
          shop_id: String(m.shop_id),
          shop_name: shopName.get(String(m.shop_id)) ?? 'ร้านค้า',
          role: String(m.role),
        });
      }
      return {
        telegram_user_id: Number(l.telegram_user_id),
        user_id: String(l.user_id),
        full_name: (u?.full_name as string) ?? null,
        phone_masked: maskDigits((u?.phone as string) ?? null),
        role: String(u?.role ?? '-'),
        shops: shopList,
        riders: (riders ?? [])
          .filter((r: any) => String(r.auth_user_id) === String(l.user_id))
          .map((r: any) => ({
            rider_id: String(r.id),
            display_name: String(r.display_name ?? 'ไรเดอร์'),
            shop_name: shopName.get(String(r.shop_id)) ?? 'ร้านค้า',
          })),
        verified_at: String(l.verified_at),
        revoked_at: l.revoked_at ? String(l.revoked_at) : null,
      };
    });

    return { success: true, rows };
  } catch (err: any) {
    console.error('listTelegramIdentitiesAction error:', err);
    return { success: false, error: 'โหลดรายการไม่สำเร็จ' };
  }
}

/** Revoke a Telegram link (verified accounts stop resolving immediately). */
export async function revokeTelegramIdentityAction(
  telegramUserId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await requireSuperadmin())) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('telegram_identities')
      .update({ revoked_at: new Date().toISOString() })
      .eq('telegram_user_id', Number(telegramUserId))
      .is('revoked_at', null);
    if (error) {
      console.error('revokeTelegramIdentityAction db error:', error);
      return { success: false, error: 'ยกเลิกไม่สำเร็จ' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('revokeTelegramIdentityAction error:', err);
    return { success: false, error: 'ยกเลิกไม่สำเร็จ' };
  }
}

/** Send a test ping to a verified identity (selected from the list, never typed). */
export async function sendTelegramTestToIdentityAction(
  telegramUserId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await requireSuperadmin())) {
      return { success: false, error: 'Unauthorized: เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' };
    }
    const admin = createAdminClient();
    const { data: link } = await admin
      .from('telegram_identities')
      .select('telegram_user_id')
      .eq('telegram_user_id', Number(telegramUserId))
      .is('revoked_at', null)
      .maybeSingle();
    if (!link) return { success: false, error: 'บัญชีนี้ไม่ได้ verified อยู่' };
    const res = await sendTelegramMessage(
      Number(telegramUserId),
      '🔔 *ทดสอบจากผู้ดูแลระบบ*\nGateway ส่งถึงบัญชี verified นี้ได้ปกติค่ะ',
      { parse_mode: 'Markdown' }
    );
    return res.success ? { success: true } : { success: false, error: res.error };
  } catch (err: any) {
    console.error('sendTelegramTestToIdentityAction error:', err);
    return { success: false, error: 'ส่งทดสอบไม่สำเร็จ' };
  }
}
