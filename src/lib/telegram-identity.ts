/**
 * Verified Telegram identity resolution (operational gateway).
 *
 * A Telegram account never maps directly to a role. It maps to exactly one
 * verified user_id, and every permission is then re-resolved from the real
 * membership model (users.shop_id + shop_members + riders.auth_user_id).
 * Raw chat ids or usernames are never trusted as identity.
 */

export interface TelegramShopMembership {
  shop_id: string;
  shop_name: string;
  role: string;
  source: 'users' | 'shop_members';
}

export interface TelegramRiderIdentity {
  rider_id: string;
  shop_id: string;
  shop_name: string;
  display_name: string;
}

export interface ResolvedTelegramIdentity {
  telegram_user_id: number;
  user_id: string;
  role: string;
  is_superadmin: boolean;
  verified_at: string;
  /** Union of legacy single-shop row and active shop_members rows. */
  shops: TelegramShopMembership[];
  /** Rider rows owned via riders.auth_user_id. */
  riders: TelegramRiderIdentity[];
}

type AdminClient = {
  from: (table: string) => any;
};

/**
 * Resolve a Telegram account to its verified user and full membership set.
 * Returns null for unknown, expired-by-revoke, or inconsistent rows.
 * Callers must still verify per-resource ownership before acting.
 */
export async function resolveTelegramIdentity(
  admin: AdminClient,
  telegramUserId: number | string
): Promise<ResolvedTelegramIdentity | null> {
  const tgId = Number(telegramUserId);
  if (!Number.isSafeInteger(tgId)) return null;

  const { data: link, error: linkError } = await admin
    .from('telegram_identities')
    .select('telegram_user_id, user_id, verified_at, revoked_at')
    .eq('telegram_user_id', tgId)
    .maybeSingle();
  if (linkError || !link || link.revoked_at) return null;

  const { data: user, error: userError } = await admin
    .from('users')
    .select('id, shop_id, role')
    .eq('id', link.user_id)
    .maybeSingle();
  if (userError || !user) return null;

  const { data: memberRows } = await admin
    .from('shop_members')
    .select('shop_id, role, shops ( name )')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const shopIds = new Set<string>();
  if (user.shop_id) shopIds.add(String(user.shop_id));
  for (const row of memberRows ?? []) shopIds.add(String(row.shop_id));

  let shopNames = new Map<string, string>();
  if (shopIds.size > 0) {
    const { data: shops } = await admin
      .from('shops')
      .select('id, name')
      .in('id', [...shopIds]);
    shopNames = new Map((shops ?? []).map((s: any) => [String(s.id), String(s.name ?? 'ร้านค้า')]));
  }

  const memberRoleByShop = new Map<string, string>();
  for (const row of memberRows ?? []) {
    memberRoleByShop.set(String(row.shop_id), String(row.role));
  }

  const shops: TelegramShopMembership[] = [...shopIds].map((shopId) => {
    const fromMember = memberRoleByShop.get(shopId);
    return {
      shop_id: shopId,
      shop_name: shopNames.get(shopId) ?? 'ร้านค้า',
      role: fromMember ?? String(user.role),
      source: fromMember ? 'shop_members' : 'users',
    };
  });

  const { data: riderRows } = await admin
    .from('riders')
    .select('id, shop_id, display_name')
    .eq('auth_user_id', user.id);

  const riders: TelegramRiderIdentity[] = (riderRows ?? []).map((r: any) => ({
    rider_id: String(r.id),
    shop_id: String(r.shop_id),
    shop_name: shopNames.get(String(r.shop_id)) ?? 'ร้านค้า',
    display_name: String(r.display_name ?? 'ไรเดอร์'),
  }));

  return {
    telegram_user_id: tgId,
    user_id: String(user.id),
    role: String(user.role),
    is_superadmin: user.role === 'superadmin',
    verified_at: String(link.verified_at),
    shops,
    riders,
  };
}

/** Shops this identity may act on (superadmin sees all shops passed in). */
export function shopsForScope(
  identity: ResolvedTelegramIdentity,
  scopeShopId?: string | null
): TelegramShopMembership[] {
  if (scopeShopId) {
    return identity.shops.filter((s) => s.shop_id === scopeShopId);
  }
  return identity.shops;
}

/** True when the identity owns this rider row. */
export function ownsRider(identity: ResolvedTelegramIdentity, riderId: string): boolean {
  return identity.riders.some((r) => r.rider_id === riderId);
}

/** True when the identity has any active membership in this shop. */
export function memberOfShop(identity: ResolvedTelegramIdentity, shopId: string): boolean {
  if (identity.is_superadmin) return true;
  return identity.shops.some((s) => s.shop_id === shopId);
}
