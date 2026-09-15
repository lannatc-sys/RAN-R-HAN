/**
 * Read-only Telegram summaries (operational gateway).
 *
 * Every query is scoped by a verified identity resolved up front. Outputs
 * are minimized: order numbers and statuses only — never customer phones,
 * names, or delivery addresses in chat. Values coming from the database
 * (names, statuses) are escaped for legacy Telegram Markdown so strings
 * like `in_transit` cannot break message parsing.
 */
import type { ResolvedTelegramIdentity } from './telegram-identity';
import { escapeTelegramMarkdown as esc } from './telegram';

type AdminClient = {
  from: (table: string) => any;
};

const ACTIVE_DISPATCH = ['assigned', 'in_transit'];

function orderLine(o: any): string {
  const no = String(o.order_no ?? '?').padStart(4, '0');
  return `#${esc(no)} · ${esc(o.dispatch_status ?? o.status ?? '-')}`;
}

/** 1. My active orders across all shops I hold. */
export async function myOrdersText(
  admin: AdminClient,
  identity: ResolvedTelegramIdentity
): Promise<string> {
  const shopIds = identity.shops.map((s) => s.shop_id);
  if (shopIds.length === 0) return '📦 คุณยังไม่มีร้านที่ดูแล จึงไม่มีออเดอร์ให้ดูค่ะ';
  const { data, error } = await admin
    .from('orders')
    .select('order_no, dispatch_status, status, shop_id')
    .in('shop_id', shopIds)
    .in('dispatch_status', ACTIVE_DISPATCH)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return '📦 โหลดออเดอร์ไม่สำเร็จ ลองใหม่นะคะ';
  if (!data || data.length === 0) return '📦 ตอนนี้ไม่มี active order ค่ะ';
  return `📦 *Active orders*\n` + data.map((o: any) => `• ${orderLine(o)}`).join('\n');
}

/** 2. Shop open/close + pending/active summary. */
export async function shopStatusText(
  admin: AdminClient,
  shopId: string,
  shopName: string
): Promise<string> {
  const { data: shop } = await admin
    .from('shops')
    .select('is_open')
    .eq('id', shopId)
    .maybeSingle();
  const { data: actives } = await admin
    .from('orders')
    .select('id, status')
    .eq('shop_id', shopId)
    .in('dispatch_status', ACTIVE_DISPATCH);
  const active = (actives ?? []).length;
  const open = shop?.is_open ? '🟢 เปิด' : '🔴 ปิด';
  return `🏪 *${esc(shopName)}*\nสถานะ: ${open}\nActive orders: ${active} งาน`;
}

/** 3. My rider identities: session, GPS age/stale, inside/outside. */
export async function riderStatusText(
  admin: AdminClient,
  identity: ResolvedTelegramIdentity
): Promise<string> {
  if (identity.riders.length === 0) return '🛵 คุณยังไม่มี rider identity ที่ผูกไว้ค่ะ';
  const lines: string[] = [];
  for (const r of identity.riders) {
    const { data: session } = await admin
      .from('rider_work_sessions')
      .select('id, started_at')
      .eq('rider_id', r.rider_id)
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: loc } = await admin
      .from('rider_current_locations')
      .select('updated_at, outside_area_since')
      .eq('rider_id', r.rider_id)
      .maybeSingle();
    const state = session ? 'ออนไลน์' : 'ออฟไลน์';
    let gps = 'ไม่มีพิกัด GPS';
    let area = '';
    if (loc?.updated_at) {
      const ageS = Math.max(0, Math.floor((Date.now() - new Date(loc.updated_at).getTime()) / 1000));
      const stale = ageS > 90;
      gps = stale ? `GPS เก่า (${Math.floor(ageS / 60)} นาที)` : `GPS ปัจจุบัน (${ageS} วินาที)`;
      area = loc.outside_area_since ? ' · อยู่นอกเขต' : ' · อยู่ในเขต';
    }
    lines.push(`• *${esc(r.display_name)}* (${esc(r.shop_name)}): ${state} · ${gps}${area}`);
  }
  return `🛵 *สถานะไรเดอร์*\n` + lines.join('\n');
}

/** 4. My active offers and deliveries (rider-owned only). */
export async function riderJobsText(
  admin: AdminClient,
  identity: ResolvedTelegramIdentity
): Promise<string> {
  if (identity.riders.length === 0) return '🛵 คุณยังไม่มี rider identity ที่ผูกไว้ค่ะ';
  const riderIds = identity.riders.map((r) => r.rider_id);
  const { data: offers } = await admin
    .from('dispatch_offers')
    .select('id, order_id, status, timeout_at, orders ( order_no )')
    .in('rider_id', riderIds)
    .eq('status', 'offered');
  const live = (offers ?? []).filter(
    (o: any) => !o.timeout_at || new Date(o.timeout_at) > new Date()
  );
  const { data: deliveries } = await admin
    .from('orders')
    .select('order_no, dispatch_status')
    .in('assigned_rider_id', riderIds)
    .in('dispatch_status', ACTIVE_DISPATCH)
    .limit(5);

  const out: string[] = [];
  if (live.length > 0) {
    for (const o of live) {
      const orderRef = Array.isArray(o.orders) ? o.orders[0] : o.orders;
      const no = String(orderRef?.order_no ?? '?').padStart(4, '0');
      out.push(`• offer #${esc(no)} (id \`${o.id}\`)`);
    }
  }
  for (const d of deliveries ?? []) out.push(`• ส่งอยู่ ${orderLine(d)}`);
  if (out.length === 0) return '🛵 ตอนนี้ไม่มี offer หรืองานส่ง active ค่ะ';
  return `🛵 *งานของฉัน*\n` + out.join('\n');
}

/** 5. Settlement summary for one permitted shop (latest draft/row). */
export async function settlementText(
  admin: AdminClient,
  shopId: string,
  shopName: string
): Promise<string> {
  const { data, error } = await admin
    .from('daily_settlements')
    .select('settlement_date, status, total_orders, total_rider_payout')
    .eq('shop_id', shopId)
    .order('settlement_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return `💰 *${esc(shopName)}*\nยังไม่มีข้อมูล settlement ค่ะ`;
  return (
    `💰 *Settlement ${esc(shopName)}*\n` +
    `วันที่: ${esc(data.settlement_date)} (${esc(data.status)})\n` +
    `ออเดอร์: ${data.total_orders} · จ่ายไรเดอร์: ${data.total_rider_payout}`
  );
}

/** Daily summary for owned riders: offers by outcome + deliveries by state. */
export async function riderSummaryText(
  admin: AdminClient,
  identity: ResolvedTelegramIdentity
): Promise<string> {
  if (identity.riders.length === 0) return '🛵 คุณยังไม่มี rider identity ที่ผูกไว้ค่ะ';
  const riderIds = identity.riders.map((r) => r.rider_id);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: offers } = await admin
    .from('dispatch_offers')
    .select('status')
    .in('rider_id', riderIds)
    .gte('offered_at', dayStart.toISOString());
  const { data: orders } = await admin
    .from('orders')
    .select('dispatch_status')
    .in('assigned_rider_id', riderIds)
    .gte('created_at', dayStart.toISOString());
  const count = (rows: any[] | null, key: string, val: string) =>
    (rows ?? []).filter((r) => r[key] === val).length;
  const accepted = count(offers, 'status', 'accepted');
  const rejected = count(offers, 'status', 'rejected');
  const expired = count(offers, 'status', 'expired');
  const delivered = count(orders, 'dispatch_status', 'delivered');
  const active = (orders ?? []).filter((o: any) =>
    ['assigned', 'in_transit'].includes(o.dispatch_status)
  ).length;
  return (
    `🧾 *สรุปงานวันนี้*\n` +
    `รับงาน: ${accepted} · ปฏิเสธ: ${rejected} · หมดเวลา: ${expired}\n` +
    `ส่งสำเร็จ: ${delivered} · กำลังส่ง: ${active}`
  );
}

/** 6. My verified account: identity, roles, shops, rider. */
export function accountText(identity: ResolvedTelegramIdentity): string {
  const shops =
    identity.shops.length > 0
      ? identity.shops.map((s) => `• ${esc(s.shop_name)} (${esc(s.role)})`).join('\n')
      : '• -';
  const riders =
    identity.riders.length > 0
      ? identity.riders.map((r) => `• ${esc(r.display_name)} @ ${esc(r.shop_name)}`).join('\n')
      : '• -';
  return (
    `👤 *บัญชีของฉัน*\n` +
    `ยืนยันเมื่อ: ${esc(identity.verified_at)}\n` +
    `บทบาทหลัก: ${esc(identity.is_superadmin ? 'superadmin' : identity.role)}\n` +
    `ร้านที่ดูแล:\n${shops}\n` +
    `ไรเดอร์:\n${riders}`
  );
}
