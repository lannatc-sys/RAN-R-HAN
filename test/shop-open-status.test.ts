import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('Shop open/closed status regression guards', () => {
  const migration = source(
    'supabase/migrations/20260912000005_shop_open_status.sql'
  );

  it('keeps operational open state separate from account activation state', () => {
    assert.match(
      migration,
      /alter table public\.shops[\s\S]*add column if not exists is_open boolean not null default true/i
    );
    assert.doesNotMatch(migration, /alter type public\.shop_status/i);
  });

  it('provides a narrow authenticated RPC for shop members to change open state', () => {
    assert.match(
      migration,
      /create or replace function public\.set_shop_open_status\(\s*p_shop_id uuid,\s*p_is_open boolean\s*\)/i
    );
    assert.match(migration, /public\.has_shop_access\(p_shop_id\)/i);
    assert.match(
      migration,
      /grant execute on function public\.set_shop_open_status\(uuid, boolean\) to authenticated/i
    );
  });

  it('rejects new orders at the database boundary while the shop is closed', () => {
    assert.match(migration, /create trigger trg_enforce_shop_open_for_new_orders/i);
    assert.match(migration, /before insert on public\.orders/i);
    assert.match(migration, /SHOP_CLOSED/i);
  });

  it('hides closed shops from the public listing, menu, and checkout pages', () => {
    for (const path of [
      'src/app/page.tsx',
      'src/app/[slug]/page.tsx',
      'src/app/[slug]/checkout/page.tsx',
    ]) {
      assert.match(source(path), /\.eq\('is_open', true\)/);
    }
  });

  it('routes the settings mutation through the session-bound RPC', () => {
    const settingsAction = source('src/app/actions/settings.ts');
    assert.match(
      settingsAction,
      /export async function updateShopOpenStatusAction/
    );
    assert.match(settingsAction, /await createClient\(\)/);
    assert.match(settingsAction, /\.rpc\('set_shop_open_status'/);
  });

  it('shows accessible open and closed controls in the existing settings page', () => {
    const settingsClient = source('src/app/admin/settings/SettingsClient.tsx');
    assert.match(settingsClient, /updateShopOpenStatusAction/);
    assert.match(settingsClient, /เปิดรับออเดอร์/);
    assert.match(settingsClient, /ปิดรับออเดอร์/);
    assert.match(settingsClient, /aria-live="polite"/);
  });

  it('maps the database closed-shop error to a customer-safe Thai message', () => {
    const thaiErrors = source('src/lib/thai-errors.ts');
    assert.match(thaiErrors, /msg\.includes\('SHOP_CLOSED'\)/);
    assert.match(thaiErrors, /ร้านปิดรับออเดอร์/);
  });
});
