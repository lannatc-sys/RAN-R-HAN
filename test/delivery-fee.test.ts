import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const stripSql = (sql: string) => sql.replace(/--[^\n]*/g, '');

const MIGRATION = 'supabase/migrations/20260914000008_delivery_fee.sql';

describe('ค่าส่ง: ร้านตั้งค่าได้และมีขอบเขต', () => {
  const migration = () => stripSql(source(MIGRATION));

  it('เพิ่มคอลัมน์ delivery_base_fee ให้ shops', () => {
    assert.match(migration(), /alter table public\.shops[\s\S]{0,120}delivery_base_fee/);
  });

  it('กันค่าติดลบและค่าที่เกินเพดานด้วย constraint ที่ฐานข้อมูล', () => {
    const sql = migration();
    assert.match(sql, /delivery_base_fee >= 0/);
    assert.match(sql, /delivery_base_fee <= 1000/);
  });

  it('server action ตรวจช่วงซ้ำเพื่อให้ผู้ใช้ได้ข้อความไทย ไม่ใช่ error ดิบ', () => {
    const settings = source('src/app/actions/settings.ts');
    const start = settings.indexOf('export async function updateShopSettingsAction');
    const fn = settings.slice(start, settings.indexOf('\nexport ', start + 1));
    assert.match(fn, /deliveryBaseFee/);
    assert.match(fn, /0-1000/, 'ต้องมีข้อความบอกช่วงที่รับได้');
    const guardIdx = fn.indexOf('deliveryBaseFee < 0');
    const writeIdx = fn.indexOf('delivery_base_fee: deliveryBaseFee');
    assert.ok(guardIdx !== -1 && writeIdx !== -1);
    assert.ok(guardIdx < writeIdx, 'ต้องตรวจช่วงก่อนเขียนลงฐานข้อมูล');
  });
});

describe('ค่าส่ง: snapshot ลงออเดอร์ ไม่ใช่ join ตอนอ่าน', () => {
  const migration = () => stripSql(source(MIGRATION));

  it('เขียน delivery_fee ลง orders ตอนสร้างออเดอร์', () => {
    assert.match(migration(), /delivery_fee = v_delivery_fee/);
  });

  it('คิดค่าส่งเฉพาะออเดอร์แบบจัดส่ง', () => {
    const sql = migration();
    // migration เก็บโค้ดใหม่ไว้ในสตริงที่ escape แล้ว จึงเทียบด้วย substring ตรง ๆ
    // แทนการเขียน regex ที่ต้องหนี backslash ซ้อนหลายชั้นจนอ่านไม่ออก
    // ข้อความนี้อยู่ในสตริงที่ escape แล้วในไฟล์ migration จึงมี backslash คั่น
    // ประกอบ needle ด้วย charCode แทนการเขียน backslash ตรง ๆ ที่ผิดง่าย
    const bs = String.fromCharCode(92);
    const guard = sql.indexOf(`v_order_type = ${bs}'delivery${bs}'::public.order_type`);
    const assign = sql.indexOf('v_delivery_fee := coalesce(v_shop.delivery_base_fee');
    assert.ok(guard !== -1, 'ต้องตรวจชนิดออเดอร์ก่อนคิดค่าส่ง');
    assert.ok(assign !== -1, 'ต้องหยิบค่าส่งจาก shops.delivery_base_fee');
    assert.ok(guard < assign, 'การคิดค่าส่งต้องอยู่ใต้เงื่อนไขชนิดออเดอร์ delivery');
  });

  it('บวกค่าส่งเข้ายอดรวมครบทั้งสามโหมด VAT', () => {
    const sql = migration();
    const additions = sql.match(/v_total := v_subtotal \+ v_service_charge[^;]*\+ v_delivery_fee/g) ?? [];
    assert.equal(
      additions.length,
      3,
      'ร้านมีสามโหมด VAT (exclusive / inclusive / none) ต้องบวกค่าส่งครบทุกโหมด'
    );
  });
});

describe('ค่าส่ง: ไม่เขียน body ของ RPC ใหม่ (กับดักข้อ 1)', () => {
  const migration = () => stripSql(source(MIGRATION));

  it('ใช้ pg_get_functiondef แทนการคัดลอก body มาเขียนใหม่', () => {
    const sql = migration();
    assert.match(sql, /pg_get_functiondef/);
    assert.ok(
      !/create or replace function public\.create_pickup_order/i.test(sql),
      'ห้ามประกาศฟังก์ชันใหม่ทั้งตัว เพราะจะทำ row lock ที่มีอยู่เดิมหายไป'
    );
  });

  it('raise เมื่อหาข้อความเป้าหมายไม่เจอ แทนที่จะแก้เงียบ ๆ ไม่ครบ', () => {
    const sql = migration();
    assert.match(sql, /MIGRATION_PATTERN_COUNT_MISMATCH/);
    assert.match(sql, /MIGRATION_TARGET_AMBIGUOUS/);
  });
});

describe('ค่าส่ง: ลูกค้าเห็นก่อนกดสั่ง', () => {
  const checkout = () => stripTs(source('src/app/[slug]/checkout/CheckoutClient.tsx'));

  it('คิดค่าส่งเฉพาะตอนเลือกจัดส่ง', () => {
    assert.match(
      checkout(),
      /orderType === 'delivery' \? Number\(shop\.delivery_base_fee \?\? 0\) : 0/
    );
  });

  it('บวกเข้ายอดที่แสดงและมีบรรทัดค่าส่งให้เห็น', () => {
    const code = checkout();
    assert.match(code, /finalTotal \+= deliveryFee/);
    assert.match(code, /deliveryFee > 0 &&/, 'ต้องมีบรรทัดแสดงค่าส่งในสรุปยอด');
  });

  it('หน้าตั้งค่าของร้านมีช่องกรอกจริง ไม่ใช่แค่ state', () => {
    const settings = stripTs(source('src/app/admin/settings/SettingsClient.tsx'));
    assert.match(settings, /value=\{deliveryBaseFee\}/);
    assert.match(settings, /onChange=\{\(e\) => setDeliveryBaseFee\(e\.target\.value\)\}/);
    assert.match(settings, /delivery_base_fee: parseFloat\(deliveryBaseFee\)/);
  });
});

describe('ค่าส่ง: ปลายทางที่รออ่านค่านี้อยู่แล้ว', () => {
  it('ใบงานไรเดอร์และยอดค่ารอบยังอ่าน delivery_fee จากออเดอร์', () => {
    assert.match(source('src/app/api/rider/offers/active/route.ts'), /delivery_fee/);
    assert.match(source('src/app/api/rider/orders/active/route.ts'), /delivery_fee/);
    assert.match(source('src/app/admin/settlement/SettlementClient.tsx'), /total_delivery_fee/);
  });
});
