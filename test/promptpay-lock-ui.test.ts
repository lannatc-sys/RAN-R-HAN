import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const CLIENT = 'src/app/admin/settings/SettingsClient.tsx';
const ACTIONS = 'src/app/actions/settings.ts';

function extractFn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  assert.ok(start !== -1, `Function ${name} not found`);
  const nextExport = src.indexOf('\nexport ', start + 1);
  return src.slice(start, nextExport !== -1 ? nextExport : undefined);
}

describe('PromptPay lock UI — client (SettingsClient.tsx)', () => {
  it('defines SHOP_CAN_EDIT_PROMPTPAY = false like SHOP_CAN_EDIT_LOCATION', () => {
    const client = source(CLIENT);
    assert.match(client, /const SHOP_CAN_EDIT_LOCATION = false/);
    assert.match(client, /const SHOP_CAN_EDIT_PROMPTPAY = false/);
  });

  it('renders current promptpay fields read-only gated by the constant', () => {
    const client = source(CLIENT);
    assert.ok(
      client.includes('disabled={!SHOP_CAN_EDIT_PROMPTPAY}'),
      'promptpay inputs must be disabled when the shop cannot edit'
    );
    assert.ok(
      client.includes('readOnly={!SHOP_CAN_EDIT_PROMPTPAY}'),
      'promptpay inputs must be readOnly when the shop cannot edit'
    );
  });

  it('no longer edits promptpay through the main settings form', () => {
    const client = source(CLIENT);
    // The main save path must not send promptpay fields anymore.
    const saveStart = client.indexOf('updateShopSettingsAction({');
    assert.ok(saveStart !== -1, 'updateShopSettingsAction call not found');
    const saveCall = client.slice(saveStart, client.indexOf('});', saveStart));
    assert.doesNotMatch(saveCall, /promptpay_id|promptpay_name/);
    // The old direct setters must be gone from the display inputs.
    assert.doesNotMatch(client, /onChange=\{\(e\) => setPromptpayId/);
  });

  it('labels the current number kind: 10 digits = phone, 13 digits = citizen id', () => {
    const client = source(CLIENT);
    assert.ok(client.includes('getPromptpayIdKind'), 'must derive the id kind');
    assert.ok(client.includes('เบอร์โทรศัพท์'), '10-digit kind label must mention phone');
    assert.ok(client.includes('บัตรประชาชน'), '13-digit kind label must mention citizen id');
    assert.match(client, /digits\.length === 10/);
    assert.match(client, /digits\.length === 13/);
  });

  it('offers a request-change form and a pending state instead of direct edit', () => {
    const client = source(CLIENT);
    assert.ok(client.includes('ขอแก้ไขพร้อมเพย์'), 'must have a request-change button');
    assert.ok(client.includes('requestPromptpayChangeAction'), 'must call the existing request action');
    assert.ok(client.includes('รออนุมัติ'), 'must show a pending-approval state');
    assert.ok(
      client.includes('getPendingPromptpayRequestAction'),
      'must load the pending state on mount'
    );
  });

  it('never logs full promptpay digits from the client', () => {
    const client = source(CLIENT);
    assert.doesNotMatch(client, /console\.(log|info|debug)\(.*[Pp]romptpay/);
  });
});

describe('PromptPay lock UI — server (settings.ts)', () => {
  it('updateShopSettingsAction no longer writes promptpay fields', () => {
    const actions = source(ACTIONS);
    const fn = extractFn(actions, 'updateShopSettingsAction');
    assert.doesNotMatch(fn, /promptpay_id|promptpay_name/);
  });

  it('updateShopSettingsAction still checks auth and shop access', () => {
    const actions = source(ACTIONS);
    const fn = extractFn(actions, 'updateShopSettingsAction');
    assert.match(fn, /userError \|\| !user/);
    assert.match(fn, /has_shop_access[\s\S]*?lookup_shop_id:\s*data\.shop_id/);
  });

  it('getPendingPromptpayRequestAction guards auth before admin client and leaks no digits', () => {
    const actions = source(ACTIONS);
    const fn = extractFn(actions, 'getPendingPromptpayRequestAction');
    const checkIdx = fn.indexOf('has_shop_access');
    const adminIdx = fn.indexOf('createAdminClient()');
    assert.ok(checkIdx !== -1 && adminIdx !== -1, 'must check access and use admin client');
    assert.ok(checkIdx < adminIdx, 'access check must come before createAdminClient()');
    assert.doesNotMatch(fn, /requested_promptpay_id/);
    assert.doesNotMatch(fn, /return \{ success: false, error: (?:error|err)\.message/);
  });

  it('requestPromptpayChangeAction masks digits and returns fixed Thai errors', () => {
    const actions = source(ACTIONS);
    const fn = extractFn(actions, 'requestPromptpayChangeAction');
    assert.match(fn, /maskDigits\(data\.promptpayId\)/);
    assert.match(fn, /มีคำขอที่รออนุมัติอยู่แล้ว/);
    assert.match(fn, /ยื่นคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง/);
    assert.doesNotMatch(fn, /return \{ success: false, error: (?:error|err)\.message/);
  });
});
