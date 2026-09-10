import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('Rider P0 security regression guards', () => {
  const hardeningMigration = source(
    'supabase/migrations/20260911000005_rider_p0_hardening.sql'
  );
  const concurrencyMigration = source(
    'supabase/migrations/20260911000006_rider_concurrency_lock.sql'
  );

  it('removes direct rider mutation of offers, events, POD metadata and POD files', () => {
    assert.match(
      hardeningMigration,
      /drop policy if exists "Rider can respond to own offers" on public\.dispatch_offers/i
    );
    assert.match(
      hardeningMigration,
      /drop policy if exists "Rider can insert own delivery events" on public\.delivery_events/i
    );
    assert.match(
      hardeningMigration,
      /drop policy if exists "Rider can insert own POD" on public\.pod_uploads/i
    );
    assert.match(
      hardeningMigration,
      /drop policy if exists "Rider can read own shop POD" on storage\.objects/i
    );
  });

  it('restricts internal SECURITY DEFINER RPCs to service_role', () => {
    for (const fn of [
      'find_available_riders',
      'get_rider_active_order_count',
      'create_daily_settlement_draft',
    ]) {
      assert.match(hardeningMigration, new RegExp(`revoke all on function public\\.${fn}`, 'i'));
      assert.match(hardeningMigration, new RegExp(`grant execute on function public\\.${fn}`, 'i'));
    }
  });

  it('defines authenticated transactional RPC boundaries for critical rider state changes', () => {
    for (const fn of [
      'respond_to_dispatch_offer',
      'close_rider_work_session',
      'finalize_rider_delivery_event',
    ]) {
      assert.match(
        hardeningMigration,
        new RegExp(`create or replace function public\\.${fn}`, 'i')
      );
      assert.match(
        hardeningMigration,
        new RegExp(`grant execute on function public\\.${fn}`, 'i')
      );
    }
    assert.match(hardeningMigration, /for update/i);
  });

  it('replaces the unsafe 80/20 placeholder with the locked base rate and line items', () => {
    assert.doesNotMatch(hardeningMigration, /delivery_fee\s*\*\s*0\.8/i);
    assert.match(hardeningMigration, /15\.00/);
    assert.match(hardeningMigration, /7\.50/);
    assert.match(hardeningMigration, /insert into public\.settlement_line_items/i);
    assert.match(hardeningMigration, /PENDING_RATE_CARD/i);
  });

  it('routes critical state changes through the hardened RPCs', () => {
    assert.match(
      source('src/app/api/rider/offer/[offerId]/respond/route.ts'),
      /\.rpc\('respond_to_dispatch_offer'/
    );
    assert.match(
      source('src/app/api/rider/session/close/route.ts'),
      /\.rpc\('close_rider_work_session'/
    );
    assert.match(
      source('src/app/api/rider/order/[orderId]/event/route.ts'),
      /\.rpc\('finalize_rider_delivery_event'/
    );
  });

  it('serializes accept and close operations for the same rider', () => {
    assert.match(concurrencyMigration, /pg_advisory_xact_lock/i);
    assert.match(concurrencyMigration, /respond_to_dispatch_offer/i);
    assert.match(concurrencyMigration, /close_rider_work_session/i);
    assert.match(concurrencyMigration, /RIDER_CAPACITY_REACHED/i);
  });
});
