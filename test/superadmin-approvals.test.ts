import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

function extractSuperadminFn(sa: string, name: string): string {
  const start = sa.indexOf(`export async function ${name}`);
  assert.ok(start !== -1, `Function ${name} not found in superadmin.ts`);
  const nextExport = sa.indexOf('\nexport ', start + 1);
  return sa.slice(start, nextExport !== -1 ? nextExport : undefined);
}

describe('Superadmin approvals: promptpay queue actions', () => {
  const sa = source('src/app/actions/superadmin.ts');

  it('listPromptpayRequestsAction exists and is exported', () => {
    assert.ok(
      sa.includes('export async function listPromptpayRequestsAction'),
      'listPromptpayRequestsAction must be exported from superadmin.ts'
    );
  });

  it('reviewPromptpayRequestAction(requestId, approve, note) exists with the required signature', () => {
    assert.match(
      sa,
      /export async function reviewPromptpayRequestAction\(\s*requestId:\s*string,\s*approve:\s*boolean,\s*note\?:/,
      'reviewPromptpayRequestAction must accept (requestId, approve, note)'
    );
  });

  it('list action checks superadmin before touching the admin client', () => {
    const fn = extractSuperadminFn(sa, 'listPromptpayRequestsAction');
    const checkIdx = fn.indexOf('checkIsSuperadmin()');
    const adminIdx = fn.indexOf('createAdminClient()');
    assert.ok(checkIdx !== -1, 'must call checkIsSuperadmin()');
    assert.ok(adminIdx !== -1, 'must call createAdminClient() to bypass shop-scoped RLS');
    assert.ok(checkIdx < adminIdx, 'guard must precede admin client');
    assert.match(
      fn.slice(checkIdx, adminIdx),
      /if\s*\(\s*!isSuperadmin\s*\)\s*\{\s*return\b/,
      'must return early when not superadmin'
    );
  });

  it('count action checks superadmin before touching the admin client', () => {
    const fn = extractSuperadminFn(sa, 'getPendingPromptpayCountAction');
    const checkIdx = fn.indexOf('checkIsSuperadmin()');
    const adminIdx = fn.indexOf('createAdminClient()');
    assert.ok(checkIdx !== -1, 'must call checkIsSuperadmin()');
    assert.ok(adminIdx !== -1, 'must call createAdminClient()');
    assert.ok(checkIdx < adminIdx, 'guard must precede admin client');
  });

  it('review action checks superadmin before calling the RPC', () => {
    const fn = extractSuperadminFn(sa, 'reviewPromptpayRequestAction');
    const checkIdx = fn.indexOf('checkIsSuperadmin()');
    const rpcIdx = fn.indexOf('review_promptpay_change');
    assert.ok(checkIdx !== -1, 'must call checkIsSuperadmin()');
    assert.ok(rpcIdx !== -1, 'must call the review_promptpay_change RPC');
    assert.ok(checkIdx < rpcIdx, 'guard must precede the RPC call');
  });

  it('review action calls review_promptpay_change with the exact parameter names', () => {
    const fn = extractSuperadminFn(sa, 'reviewPromptpayRequestAction');
    assert.match(fn, /p_request_id/, 'must pass p_request_id (matches migration signature)');
    assert.match(fn, /p_approve/, 'must pass p_approve (matches migration signature)');
    assert.match(fn, /p_note/, 'must pass p_note (matches migration signature)');
  });

  it('review action uses the session-bound client so auth.uid() reaches the RPC', () => {
    const fn = extractSuperadminFn(sa, 'reviewPromptpayRequestAction');
    assert.ok(
      fn.includes('await createClient()'),
      'must use session-bound createClient(), not the admin client, for the RPC'
    );
  });

  it('list action reads only the pending queue ordered by request time', () => {
    const fn = extractSuperadminFn(sa, 'listPromptpayRequestsAction');
    assert.match(fn, /\.eq\('status',\s*'pending'\)/, 'must filter status = pending');
    assert.match(
      fn,
      /\.order\('requested_at',\s*\{\s*ascending:\s*true\s*\}\)/,
      'oldest request first'
    );
  });

  it('new approval actions never return raw error.message to the client', () => {
    for (const name of [
      'listPromptpayRequestsAction',
      'getPendingPromptpayCountAction',
      'reviewPromptpayRequestAction',
    ]) {
      const fn = extractSuperadminFn(sa, name);
      assert.doesNotMatch(
        fn,
        /return \{ success: false, error: (?:error|err)\.message/,
        `${name} must map errors to fixed Thai messages`
      );
      assert.doesNotMatch(
        fn,
        /error: err\.message \|\|/,
        `${name} must not fall back to err.message`
      );
    }
  });

  it('review action maps known RPC failure codes to fixed Thai messages', () => {
    const fn = extractSuperadminFn(sa, 'reviewPromptpayRequestAction');
    assert.match(fn, /REQUEST_NOT_FOUND/, 'must translate REQUEST_NOT_FOUND');
    assert.match(fn, /REQUEST_ALREADY_REVIEWED/, 'must translate REQUEST_ALREADY_REVIEWED');
  });

  it('list action documents the PDPA restriction on full promptpay numbers', () => {
    const fn = extractSuperadminFn(sa, 'listPromptpayRequestsAction');
    assert.match(fn, /PDPA/, 'must note that full numbers stay inside /superadmin/approvals');
  });
});

describe('Superadmin approvals: page and sidebar', () => {
  it('approvals page exists under superadmin', () => {
    assert.ok(
      existsSync(resolve(root, 'src/app/superadmin/approvals/page.tsx')),
      'src/app/superadmin/approvals/page.tsx must exist'
    );
  });

  it('approvals client component exists alongside the page', () => {
    assert.ok(
      existsSync(resolve(root, 'src/app/superadmin/approvals/ApprovalsClient.tsx')),
      'ApprovalsClient.tsx must live next to the page'
    );
  });

  it('approvals page loads the queue through listPromptpayRequestsAction', () => {
    const page = source('src/app/superadmin/approvals/page.tsx');
    assert.match(page, /listPromptpayRequestsAction/, 'page must read via the list action');
  });

  it('approvals client offers approve, reject and a review note field', () => {
    const client = source('src/app/superadmin/approvals/ApprovalsClient.tsx');
    assert.match(client, /reviewPromptpayRequestAction/, 'client must call the review action');
    assert.match(client, /อนุมัติ/, 'must have an approve button');
    assert.match(client, /ปฏิเสธ/, 'must have a reject button');
    assert.match(client, /textarea/, 'must have a note field');
  });

  it('approvals client shows the kind of the requested number (10 vs 13 digits)', () => {
    const client = source('src/app/superadmin/approvals/ApprovalsClient.tsx');
    assert.match(client, /13 หลัก/, 'must distinguish national-id numbers from phone numbers');
  });

  it('approvals UI keeps the superadmin light theme: zero dark: classes', () => {
    for (const path of [
      'src/app/superadmin/approvals/page.tsx',
      'src/app/superadmin/approvals/ApprovalsClient.tsx',
    ]) {
      assert.doesNotMatch(
        source(path),
        /dark:/,
        `${path} must not use dark: variants like the other superadmin pages`
      );
    }
  });

  it('approvals page does not mask the numbers (full display is allowed only here)', () => {
    for (const path of [
      'src/app/superadmin/approvals/page.tsx',
      'src/app/superadmin/approvals/ApprovalsClient.tsx',
    ]) {
      assert.doesNotMatch(
        source(path),
        /maskDigits/,
        `${path} shows full numbers by design; masking belongs everywhere else`
      );
    }
  });

  it('sidebar links to the approvals queue the same way as the service-area page', () => {
    const sidebar = source('src/components/superadmin/SuperadminSidebar.tsx');
    assert.match(sidebar, /href:\s*'\/superadmin\/approvals'/, 'must add the approvals nav item');
    assert.match(sidebar, /คำขออนุมัติ/, 'must label the item คำขออนุมัติ');
  });

  it('sidebar shows the pending-request count badge', () => {
    const sidebar = source('src/components/superadmin/SuperadminSidebar.tsx');
    assert.match(
      sidebar,
      /getPendingPromptpayCountAction/,
      'sidebar must fetch the pending count without pulling full PDPA numbers'
    );
    assert.match(sidebar, /pendingApprovals/, 'sidebar must render the count badge');
  });
});
