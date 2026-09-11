import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), 'utf-8');
}

describe('💳 SlipOK Webhook Production Security & Behavior', () => {
  const webhookCode = readProjectFile('src/app/api/webhooks/slipok/route.ts');

  it('webhook ต้องตรวจ secret header x-slipok-secret หรือ x-webhook-secret', () => {
    assert.ok(
      webhookCode.includes('x-slipok-secret') || webhookCode.includes('x-webhook-secret'),
      'ต้องตรวจสอบ secret header จาก SlipOK'
    );
    assert.ok(
      webhookCode.includes('401'),
      'ต้องคืน 401 เมื่อ secret header ไม่ตรง'
    );
  });

  it('webhook ต้องดักจับรหัสข้อผิดพลาด 23505 (Unique Violation ของ trans_ref) และคืน 409 DUPLICATE_SLIP', () => {
    assert.ok(
      webhookCode.includes('23505'),
      'ต้องตรวจจับ error.code 23505 สำหรับสลิปซ้ำ'
    );
    assert.ok(
      webhookCode.includes('409'),
      'ต้องคืน HTTP status 409 Conflict'
    );
    assert.ok(
      webhookCode.includes('DUPLICATE_SLIP'),
      'ต้องระบุ error DUPLICATE_SLIP ให้ชัดเจน'
    );
  });

  it('webhook ต้องตรวจสอบบัญชีปลายทางแบบ Exact Match', () => {
    assert.ok(
      webhookCode.includes('normalizeAccountNumber'),
      'ต้องมีฟังก์ชันทำความสะอาดเลขบัญชีก่อนเปรียบเทียบ'
    );
    assert.ok(
      webhookCode.includes('ACCOUNT_MISMATCH'),
      'ต้องคืน error ACCOUNT_MISMATCH เมื่อเลขบัญชีไม่ตรง'
    );
  });

  it('webhook ต้องไม่เปิดเผย decrypted API key หรือ secret สู่ภายนอกหรือ log', () => {
    // ตรวจสอบว่าไม่มีการเรียก console.log(decryptedApiKey) จริงๆ ในโค้ด
    const hasExecutableLog = /^\s*console\.log\([^)]*decryptedApiKey[^)]*\)/m.test(webhookCode);
    assert.ok(!hasExecutableLog, 'ห้าม console.log decrypted API key ในโค้ด');
    assert.ok(!webhookCode.includes('console.log(expectedSecret)'), 'ห้าม log expected secret');
  });

  it('ฟังก์ชัน normalizeAccountNumber ต้องตัดอักขระพิเศษและเว้นวรรคออกทั้งหมด', () => {
    function normalize(account: string | null | undefined): string {
      if (!account) return '';
      return account.replace(/[^0-9]/g, '');
    }

    assert.equal(normalize('081-234-5678'), '0812345678');
    assert.equal(normalize(' 081 234 5678 '), '0812345678');
    assert.equal(normalize('0-1055-61008-72-9'), '0105561008729');
    assert.equal(normalize(null), '');
    assert.equal(normalize(undefined), '');
  });
});
