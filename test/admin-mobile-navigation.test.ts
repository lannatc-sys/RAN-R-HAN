import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const navbarSource = readFileSync(
  resolve(import.meta.dirname, '../src/components/admin/AdminNavbar.tsx'),
  'utf8'
);
const mobileNavigationSource = readFileSync(
  resolve(import.meta.dirname, '../src/components/admin/AdminMobileNavigation.tsx'),
  'utf8'
);
const navigationSource = `${navbarSource}\n${mobileNavigationSource}`;

describe('Admin mobile navigation regression guards', () => {
  it('uses an accessible mobile menu trigger linked to the drawer', () => {
    assert.match(navigationSource, /aria-controls="admin-mobile-navigation"/);
    assert.match(navigationSource, /aria-expanded=\{isMobileNavOpen\}/);
    assert.match(navigationSource, /aria-label=\{[^}]*openMenu[^}]*\}/);
  });

  it('keeps the full navigation out of the mobile document flow', () => {
    assert.match(navigationSource, /<dialog[\s\S]*id="admin-mobile-navigation"/);
    assert.match(
      navbarSource,
      /className="(?=[^"]*\bhidden\b)(?=[^"]*\blg:flex\b)[^"]*"/
    );
    assert.match(navigationSource, /\.showModal\(\)/);
  });

  it('supports native dismissal and closes after navigation', () => {
    assert.match(navigationSource, /onClose=\{closeMobileNavigation\}/);
    assert.match(navigationSource, /if \(event\.target === event\.currentTarget\)/);
    assert.match(navigationSource, /drawerRef\.current\?\.close\(\)/);
    assert.match(navigationSource, /}, \[pathname\]\);/);
  });

  it('keeps mobile-only actions inside the drawer', () => {
    assert.match(navigationSource, /lg:hidden/);
    assert.match(navigationSource, /<HeaderControls/);
    assert.match(navigationSource, /<PushNotificationPrompt shopId=\{shopId\}/);
    assert.match(navigationSource, /href="\/superadmin"/);
  });
});
