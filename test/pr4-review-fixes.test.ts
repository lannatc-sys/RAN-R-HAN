import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const mapClient = () => source('src/app/superadmin/service-area-map/ServiceAreaMapClient.tsx');

describe('CI ต้องรันเทสชุดเดียวกับ test:unit', () => {
  it('script test กับ test:unit ต้องมีไฟล์เทสชุดเดียวกัน', () => {
    const pkg = JSON.parse(source('package.json')) as {
      scripts: Record<string, string>;
    };
    const files = (script: string) =>
      script
        .split(/\s+/)
        .filter((token) => token.endsWith('.test.ts'))
        .sort();

    const inTest = files(pkg.scripts.test);
    const inUnit = files(pkg.scripts['test:unit']);

    // CI (.github/workflows/ci.yml) รัน `pnpm test` ไม่ใช่ `pnpm test:unit`
    // เทสที่เพิ่มเข้าไปแต่ test:unit อย่างเดียวจึงไม่เคยถูกรันใน CI เลย
    assert.deepEqual(
      inUnit.filter((f) => !inTest.includes(f)),
      [],
      'มีไฟล์เทสที่อยู่ใน test:unit แต่ไม่อยู่ใน test — CI จะไม่รันไฟล์นั้น'
    );

    for (const [label, list] of [
      ['test', inTest],
      ['test:unit', inUnit],
    ] as const) {
      const dupes = list.filter((f, i) => list.indexOf(f) !== i);
      assert.deepEqual(dupes, [], `${label} มีไฟล์เทสซ้ำ: ${dupes.join(', ')}`);
    }
  });

  it('ci.yml ยังเรียก pnpm test อยู่ (สมมติฐานของเทสข้างบน)', () => {
    assert.match(source('.github/workflows/ci.yml'), /pnpm test\b/);
  });
});

describe('หน้าแผนที่พื้นที่ต้องไม่โหลดวนและไม่หลุดไปใช้รูปสาธิต', () => {
  it('ไม่เอา located ที่สร้างใหม่ทุก render ไปใส่ deps ของ effect', () => {
    const code = stripTs(mapClient());
    assert.ok(
      !/\}, \[selectedShopId, located\]\)/.test(code),
      'located ถูกสร้างใหม่ทุก render ถ้าอยู่ใน deps จะวนเรียก server action ไม่จบ'
    );
    assert.match(code, /useMemo/, 'located/unlocated ต้อง memo');
  });

  it('mount editor เฉพาะตอนโหลดพื้นที่สำเร็จ ไม่ปล่อยให้ default เป็นรูปสาธิต', () => {
    const code = stripTs(mapClient());
    assert.ok(
      !/\{\.\.\.\(seed \? \{ initialState: seed \} : \{\}\)\}/.test(code),
      'การ spread แบบมีเงื่อนไขทำให้ตอน seed เป็น null shell ไปใช้ DEMO_INITIAL_EDITOR_STATE'
    );
    assert.match(
      code,
      /seedState === 'ready' && seed && \(/,
      'ต้อง mount เฉพาะสถานะ ready และมี seed จริง'
    );
    assert.match(code, /seedState === 'error'/, 'ต้องมีสถานะ error แยกให้ผู้ใช้ลองใหม่');
  });

  it('ส่ง mode live ให้ shell เพื่อไม่ให้มีป้าย scaffold และปุ่มบันทึกจำลอง', () => {
    assert.match(stripTs(mapClient()), /mode="live"/);
  });
});

describe('ร้านที่ยังไม่มีพิกัดต้องปักหมุดครั้งแรกได้', () => {
  it('ปุ่มเลือกร้านไล่จาก shops ทั้งหมด ไม่ใช่เฉพาะร้านที่ปักหมุดแล้ว', () => {
    const code = stripTs(mapClient());
    assert.ok(
      !/\{located\.map\(\(shop\) => \{/.test(code),
      'ถ้าเลือกได้เฉพาะร้านที่ปักหมุดแล้ว ร้านใหม่จะไม่มีทางได้พิกัดครั้งแรก'
    );
    assert.match(code, /\{shops\.map\(\(shop\) => \{/);
  });

  it('ปุ่มบันทึกพื้นที่ถูกปิดจนกว่าจะมีพิกัด', () => {
    assert.match(stripTs(mapClient()), /disabled=\{pending \|\| !selectedIsLocated\}/);
  });
});

describe('ลบพื้นที่ที่บันทึกไว้ได้จริง', () => {
  it('มีเส้นทางส่ง geojson null ไปยัง action', () => {
    const code = stripTs(mapClient());
    assert.match(code, /handleRemoveSavedPolygon/);
    assert.match(code, /geojson: null/, 'ต้องส่ง null เพื่อลบ ไม่ใช่แค่ล้าง state ในหน้าจอ');
    assert.match(code, /window\.confirm/, 'การลบของที่บันทึกไว้ต้องถามยืนยันก่อน');
  });
});

describe('ต้องมีคนเปิดการจำกัดพื้นที่ได้', () => {
  const superadmin = () => source('src/app/actions/superadmin.ts');

  it('มี action ตั้งค่า enabled และรัศมี', () => {
    const src = superadmin();
    assert.match(src, /export async function setShopServiceAreaSettingsAction/);
    assert.match(src, /set_shop_service_area_settings/);
  });

  it('action ตรวจ superadmin ก่อนทำอะไร', () => {
    const src = superadmin();
    const start = src.indexOf('export async function setShopServiceAreaSettingsAction');
    const fn = src.slice(start, src.indexOf('\nexport ', start + 1));
    const checkIdx = fn.indexOf('checkIsSuperadmin()');
    const rpcIdx = fn.indexOf('supabase.rpc');
    assert.ok(checkIdx !== -1 && checkIdx < rpcIdx);
  });

  it('หน้าแผนที่มี control เปิดใช้งานจริง', () => {
    const code = stripTs(mapClient());
    assert.match(code, /setShopServiceAreaSettingsAction/);
    assert.match(code, /enabledDraft/);
  });
});

describe('superadmin actions ต้องไม่คืน error ดิบจากฐานข้อมูล', () => {
  it('ไม่เหลือ err.message ใน superadmin.ts เลยสักจุด', () => {
    const src = superadminSource();
    const leaks = src.match(/error: err\.message/g) ?? [];
    assert.deepEqual(leaks, [], 'ต้องแปลเป็นข้อความไทยคงที่ก่อนส่งกลับ client ทุกจุด');
  });

  function superadminSource() {
    return source('src/app/actions/superadmin.ts');
  }
});

describe('การแก้ข้อมูลร้านต้องมีร่องรอยเสมอ', () => {
  it('เขียน audit ก่อนแก้ข้อมูล และล้มแล้วไม่แก้', () => {
    const src = source('src/app/actions/superadmin.ts');
    const start = src.indexOf('export async function updateShopBasicInfoAction');
    const fn = src.slice(start, src.indexOf('\nexport ', start + 1));

    const auditIdx = fn.indexOf("from('audit_logs')");
    const updateIdx = fn.indexOf("from('shops')");
    assert.ok(auditIdx !== -1 && updateIdx !== -1);
    assert.ok(
      auditIdx < updateIdx,
      'audit ต้องถูกเขียนก่อน ไม่งั้น audit ล้มแล้วข้อมูลเปลี่ยนไปแล้วโดยไม่มีร่องรอย'
    );
    assert.match(fn, /auditError/, 'ต้องตรวจผลของการเขียน audit');
  });

  it('รายงานเมื่อไม่พบร้าน ไม่ใช่ตอบสำเร็จเงียบ ๆ', () => {
    const src = source('src/app/actions/superadmin.ts');
    const start = src.indexOf('export async function updateShopBasicInfoAction');
    const fn = src.slice(start, src.indexOf('\nexport ', start + 1));
    assert.match(fn, /ไม่พบร้านค้านี้/);
  });
});

describe('ขอบเขตของ C4 ต้องเขียนตรงกับความจริง', () => {
  it('migration บอกชัดว่ายังไม่ครอบเส้นทางไรเดอร์', () => {
    const migration = source(
      'supabase/migrations/20260914000005_enforce_polygon_service_area.sql'
    );
    assert.match(
      migration,
      /rider_work_area_polygon/,
      'ต้องระบุไว้ว่า polygon ของไรเดอร์ยังไม่มีผล'
    );
    assert.ok(
      !/ตัวเดียวกับเส้นทางอื่น/.test(migration),
      'ข้อความเดิมอ้างว่าใช้ predicate ร่วมกับเส้นทางอื่นแล้ว ซึ่งไม่จริง'
    );
  });

  it('เส้นทางไรเดอร์ยังใช้ calc_distance_meters อยู่จริง (คุมไม่ให้เอกสารเพี้ยนอีก)', () => {
    const enforcement = source(
      'supabase/migrations/20260912000006_service_area_enforcement.sql'
    );
    for (const fn of [
      'start_rider_work_session',
      'report_rider_location',
      'sweep_expired_rider_geofence_sessions',
    ]) {
      assert.ok(enforcement.includes(fn), `ไม่พบฟังก์ชัน ${fn}`);
    }
    assert.match(enforcement, /calc_distance_meters/);
  });
});
