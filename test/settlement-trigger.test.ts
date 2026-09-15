import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const CRON_ROUTE = 'src/app/api/cron/daily-settlement/route.ts';
const ACTION = 'src/app/actions/settlement.ts';
const CLIENT = 'src/app/admin/settlement/SettlementClient.tsx';
const WORKFLOW = '.github/workflows/cron-daily-settlement.yml';

/**
 * ตรรกะการคิดเงินถูกทดสอบกับฐานข้อมูลจริงใน
 * test/settlement-payout.integration.cjs แล้ว
 * ไฟล์นี้คุมเฉพาะชั้นที่เรียกมัน ว่ามีสองทางเข้าและทั้งคู่ไปที่ RPC ตัวเดียวกัน
 */

describe('1. cron เรียก draft ได้ และใช้ pattern เดิมของโปรเจกต์', () => {
  it('route มีอยู่จริงและรับทั้ง GET และ POST เหมือน cron ตัวอื่น', () => {
    assert.ok(existsSync(resolve(root, CRON_ROUTE)), 'ต้องมี route');
    const code = stripTs(source(CRON_ROUTE));
    assert.match(code, /export async function GET/);
    assert.match(code, /export async function POST/);
  });

  it('เรียก RPC ตัวเดียวกับที่ทดสอบไว้ ไม่คำนวณเงินเอง', () => {
    const code = stripTs(source(CRON_ROUTE));
    assert.match(code, /create_daily_settlement_draft/);
    assert.ok(
      !/rider_payout|shop_portion|delivery_fee \*|0\.8|15\.00/.test(code),
      'เส้นทาง cron ต้องไม่มีสูตรคิดเงินของตัวเอง'
    );
  });

  it('มี workflow ตามรูปแบบเดิม ไม่ได้สร้าง scheduler แบบใหม่', () => {
    assert.ok(existsSync(resolve(root, WORKFLOW)));
    const yml = source(WORKFLOW);
    assert.match(yml, /secrets\.CRON_SECRET/);
    assert.match(yml, /\/api\/cron\/daily-settlement/);
    assert.match(yml, /schedule:/);
  });
});

describe('2. rerun วันเดิมต้องไม่สร้างซ้ำ', () => {
  it('cron ไม่ลบหรือเขียนตาราง settlement เอง ปล่อยให้ RPC กันซ้ำ', () => {
    const code = stripTs(source(CRON_ROUTE));
    assert.ok(
      !/from\('daily_settlements'\)[\s\S]{0,200}\.(insert|upsert|delete|update)\(/.test(code),
      'ห้ามเขียนตาราง settlement ตรง ๆ เพราะจะข้าม on conflict ของ RPC'
    );
  });

  it('action ก็ไม่เขียนตารางเอง', () => {
    const code = stripTs(source(ACTION));
    assert.ok(!/from\('daily_settlements'\)/.test(code));
    assert.ok(!/from\('settlement_line_items'\)/.test(code));
  });
});

describe('3. ปุ่มในหน้าแอดมินเรียก RPC เดียวกัน', () => {
  it('ปุ่มเรียกผ่าน action ตัวเดียวกับที่เรียก RPC', () => {
    const client = stripTs(source(CLIENT));
    assert.match(client, /createDailySettlementDraftAction/);
    assert.match(client, /onClick=\{\(\) => handleCreateDraft/);
  });

  it('action เรียก RPC ตัวเดียวกับ cron', () => {
    const action = stripTs(source(ACTION));
    const cron = stripTs(source(CRON_ROUTE));
    assert.match(action, /create_daily_settlement_draft/);
    assert.match(cron, /create_daily_settlement_draft/);
  });

  it('ไม่มีสูตรคิดเงินฝั่ง client', () => {
    const client = stripTs(source(CLIENT));
    // ตัวเลขใน CSS เช่น 0.875rem ไม่ใช่สูตรคิดเงิน จึงเจาะจงเฉพาะการคำนวณ
    // ที่อ้างถึงฟิลด์เงินจริง
    assert.ok(
      !/delivery_fee\s*[*+\-\/]/.test(client),
      'หน้าจอต้องไม่คำนวณจากค่าส่งเอง'
    );
    assert.ok(
      !/rider_payout\s*=[^=]/.test(client),
      'หน้าจอต้องไม่กำหนดค่าตอบแทนเอง ต้องแสดงยอดที่ระบบคำนวณ'
    );
  });
});

describe('4. สิทธิ์ข้ามร้านต้องถูกปฏิเสธ', () => {
  const action = () => stripTs(source(ACTION));

  it('ตรวจ login แล้วตรวจสิทธิ์ร้านก่อนแตะ admin client', () => {
    const code = action();
    const authIdx = code.indexOf('auth.getUser()');
    const accessIdx = code.indexOf('has_shop_access');
    const adminIdx = code.indexOf('createAdminClient()');

    assert.ok(authIdx !== -1 && accessIdx !== -1 && adminIdx !== -1);
    assert.ok(authIdx < accessIdx, 'ต้องตรวจ login ก่อนตรวจสิทธิ์ร้าน');
    assert.ok(accessIdx < adminIdx, 'ต้องตรวจสิทธิ์ร้านก่อนหยิบ admin client');
  });

  it('ไม่มีสิทธิ์แล้ว return ทันที', () => {
    const code = action();
    const accessIdx = code.indexOf('has_shop_access');
    const adminIdx = code.indexOf('createAdminClient()');
    assert.match(
      code.slice(accessIdx, adminIdx),
      /if\s*\(\s*!hasAccess\s*\)\s*\{\s*return\b/,
      'ต้อง return ก่อนถึง admin client'
    );
  });

  it('ไม่คืนข้อความ error ดิบกลับ client', () => {
    assert.ok(!/error:\s*(err|error)\.message/.test(action()));
  });

  it('cron ป้องกันด้วย CRON_SECRET แบบ fail-closed', () => {
    const code = stripTs(source(CRON_ROUTE));
    assert.match(code, /CRON_SECRET/);
    const idx = code.indexOf('CRON_SECRET');
    const block = code.slice(idx, idx + 700);
    assert.match(block, /status:\s*500/, 'ไม่ตั้ง secret ต้องปฏิเสธ ไม่ใช่ทำงานต่อ');
    assert.match(block, /status:\s*401/, 'secret ไม่ตรงต้อง 401');
  });
});

describe('5. ไม่มีงานส่งถึง ต้องได้ผลที่ปลอดภัย', () => {
  const code = () => stripTs(source(CRON_ROUTE));

  it('เลือกเฉพาะร้านที่มีงานส่งถึงจริงในวันนั้น', () => {
    const c = code();
    assert.match(c, /delivery_events/);
    assert.match(c, /'delivered', 'unreachable_drop'/);
  });

  it('ไม่มีร้านเข้าเกณฑ์ ต้องจบแบบสำเร็จโดยไม่สร้างใบเปล่า', () => {
    const c = code();
    const idx = c.indexOf('shopIds.length === 0');
    assert.ok(idx !== -1, 'ต้องมีทางออกสำหรับกรณีไม่มีร้าน');
    const block = c.slice(idx, idx + 400);
    assert.match(block, /shops_processed:\s*0/);
    assert.ok(
      !/create_daily_settlement_draft/.test(block),
      'ไม่มีงานส่งถึงแล้วต้องไม่เรียก RPC เลย'
    );
  });

  it('ร้านหนึ่งล้มต้องไม่ทำให้ร้านอื่นไม่ได้ใบ และต้องรายงานว่าล้ม', () => {
    const c = code();
    assert.match(c, /failed \+= 1/);
    assert.match(c, /status = failed > 0 \? 502 : 200/);
  });

  it('รูปแบบวันที่ที่ส่งมาต้องถูกตรวจ', () => {
    assert.match(code(), /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
    assert.match(stripTs(source(ACTION)), /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  });
});
