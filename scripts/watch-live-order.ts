import { createAdminClient } from '../src/lib/supabase/admin';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function watch() {
  const admin = createAdminClient();
  const shopId = '9ba07a9c-3ef7-4de8-a632-03680c38ca9d'; // ครัวป้าแดง

  console.log('========================================================');
  console.log('📡 RAN-R-HAN Live Mobile Test Monitor (Watching Events)');
  console.log('Target Shop: ครัวป้าแดง (krua-pa-daeng)');
  console.log('Press Ctrl+C to stop watching.');
  console.log('========================================================\n');

  let lastOrderState: Record<string, string> = {};
  let lastOfferState: Record<string, string> = {};
  let lastPaymentState: Record<string, string> = {};

  const pollInterval = 3000; // ทุก 3 วินาที

  setInterval(async () => {
    try {
      const nowStr = new Date().toLocaleTimeString('th-TH');

      // 1. ตรวจสอบออเดอร์ล่าสุด
      const { data: orders } = await admin
        .from('orders')
        .select('id, order_no, status, dispatch_status, assigned_rider_id, total, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(3);

      for (const order of orders || []) {
        const key = `${order.status}:${order.dispatch_status}:${order.assigned_rider_id}`;
        if (lastOrderState[order.id] !== key) {
          console.log(
            `[${nowStr}] 📦 ORDER #${order.order_no} (${order.id.slice(0, 8)}...): ` +
              `Status=${order.status} | Dispatch=${order.dispatch_status || 'none'} | Rider=${order.assigned_rider_id ? order.assigned_rider_id.slice(0, 8) + '...' : 'none'}`
          );
          lastOrderState[order.id] = key;
        }
      }

      // 2. ตรวจสอบสถานะการชำระเงิน
      const { data: payments } = await admin
        .from('payments')
        .select('id, order_id, amount, status, verified_at, trans_ref')
        .order('created_at', { ascending: false })
        .limit(3);

      for (const payment of payments || []) {
        const key = `${payment.status}:${payment.trans_ref}`;
        if (lastPaymentState[payment.id] !== key) {
          console.log(
            `[${nowStr}] 💳 PAYMENT (${payment.id.slice(0, 8)}...): ` +
              `Status=${payment.status} | Amount=${payment.amount} | SlipRef=${payment.trans_ref || 'none'}`
          );
          lastPaymentState[payment.id] = key;
        }
      }

      // 3. ตรวจสอบ Dispatch Offers
      const { data: offers } = await admin
        .from('dispatch_offers')
        .select('id, order_id, rider_id, status, timeout_at')
        .order('created_at', { ascending: false })
        .limit(3);

      for (const offer of offers || []) {
        const key = `${offer.status}`;
        if (lastOfferState[offer.id] !== key) {
          console.log(
            `[${nowStr}] 🛵 OFFER (${offer.id.slice(0, 8)}...): ` +
              `Rider=${offer.rider_id.slice(0, 8)}... | Status=${offer.status} | TimeoutAt=${offer.timeout_at}`
          );
          lastOfferState[offer.id] = key;
        }
      }
    } catch (err: any) {
      // ignore network blips
    }
  }, pollInterval);
}

watch();
