import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const POD_ROUTE = 'src/app/api/rider/order/[orderId]/pod/route.ts';
const EVENT_ROUTE = 'src/app/api/rider/order/[orderId]/event/route.ts';
const RIDER_CLIENT = 'src/app/rider/RiderClient.tsx';

/**
 * เทสชุดนี้คุมเฉพาะชั้น HTTP route ที่ฐานข้อมูลมองไม่เห็น
 * ส่วนพฤติกรรมของ RPC และ state machine ทดสอบกับ PostgreSQL จริงแล้วใน
 * test/pod-postgres.integration.cjs ซึ่งพิสูจน์ว่าไม่ลอยด้วยการถอด guard
 * ออกจากฟังก์ชันจริงแล้วเทสแดงทันที
 */

describe('POD upload: ลำดับการตรวจสิทธิ์', () => {
  const route = () => stripTs(source(POD_ROUTE));

  it('ตรวจ session ก่อนแตะ storage หรือ admin client', () => {
    const code = route();
    const authIdx = code.indexOf('auth.getUser()');
    const adminIdx = code.indexOf('createAdminClient()');
    const uploadIdx = code.indexOf(".from('pod-uploads')");

    assert.ok(authIdx !== -1, 'ต้องตรวจ session');
    assert.ok(adminIdx !== -1 && uploadIdx !== -1);
    assert.ok(authIdx < adminIdx, 'ต้องตรวจ session ก่อนหยิบ admin client');
    assert.ok(authIdx < uploadIdx, 'ต้องตรวจ session ก่อนอัปโหลดไฟล์');
  });

  it('ตรวจว่า order ถูก assign ให้ไรเดอร์คนนี้ก่อนอัปโหลด', () => {
    const code = route();
    const ownerIdx = code.indexOf('order.assigned_rider_id !== rider.id');
    const uploadIdx = code.indexOf('.upload(');
    assert.ok(ownerIdx !== -1, 'ต้องเทียบเจ้าของงานกับไรเดอร์ที่ยิงเข้ามา');
    assert.ok(ownerIdx < uploadIdx, 'ต้องปฏิเสธก่อนเปลืองพื้นที่เก็บไฟล์');
    assert.match(code.slice(ownerIdx, uploadIdx), /status:\s*403/);
  });

  it('ไรเดอร์ถูกค้นจาก auth_user_id ไม่ใช่ค่าที่ client ส่งมา', () => {
    assert.match(route(), /\.eq\('auth_user_id',\s*user\.id\)/);
  });
});

describe('POD upload: ไฟล์ที่ไม่ถูกต้องต้องถูกปฏิเสธ', () => {
  const route = () => stripTs(source(POD_ROUTE));

  it('ไม่แนบไฟล์ ปฏิเสธ 400', () => {
    assert.match(route(), /if \(!file\)[\s\S]{0,160}status:\s*400/);
  });

  it('event_type นอกรายการ ปฏิเสธ 400', () => {
    const code = route();
    assert.match(code, /VALID_POD_EVENT_TYPES\.includes\(eventType\)/);
    assert.match(code, /VALID_POD_EVENT_TYPES = \[[^\]]*'delivered'/);
  });

  it('จำกัดชนิดไฟล์และขนาด', () => {
    const code = route();
    assert.match(code, /ALLOWED_MIME_TYPES\.includes\(file\.type\)/);
    assert.match(code, /file\.size > MAX_FILE_SIZE/);
    assert.match(code, /MAX_FILE_SIZE = 10 \* 1024 \* 1024/);
  });
});

describe('POD upload: ที่เก็บไฟล์ผูกกับร้านและงานที่ถูกต้อง', () => {
  const route = () => stripTs(source(POD_ROUTE));

  it('path ประกอบจาก shop_id ของ order ไม่ใช่ค่าที่ client ส่งมา', () => {
    const code = route();
    assert.match(
      code,
      /const storagePath = `pod\/\$\{order\.shop_id\}\/\$\{orderId\}\//,
      'path ต้องมาจาก order.shop_id ที่อ่านจากฐานข้อมูล'
    );
  });

  it('ไม่ทับไฟล์เดิม', () => {
    assert.match(route(), /upsert:\s*false/);
  });

  it('metadata ที่บันทึกใช้ shop_id ของ order และ rider ที่ตรวจแล้ว', () => {
    const code = route();
    const insertIdx = code.indexOf(".from('pod_uploads')");
    const block = code.slice(insertIdx, insertIdx + 700);
    assert.match(block, /order_id:\s*orderId/);
    assert.match(block, /rider_id:\s*rider\.id/);
    assert.match(block, /shop_id:\s*order\.shop_id/);
  });

  it('เวลาที่บันทึกเป็นเวลาฝั่งเซิร์ฟเวอร์ ไม่ใช่นาฬิกามือถือ', () => {
    const code = route();
    assert.match(code, /server_received_at:\s*serverReceivedAt\.toISOString\(\)/);
    assert.ok(
      !/server_received_at.*formData\.get/.test(code),
      'ห้ามรับเวลาจาก client'
    );
  });

  it('POD ที่เพิ่งอัปโหลดยังไม่ถูกผูกกับ event ใด', () => {
    assert.match(
      stripTs(source(POD_ROUTE)),
      /delivery_event_id:\s*null/,
      'การผูกต้องเกิดที่ RPC ตอนปิดงาน ไม่ใช่ตอนอัปโหลด'
    );
  });
});

describe('POD upload: ล้มแล้วต้องไม่ทิ้ง state ครึ่ง ๆ', () => {
  const route = () => stripTs(source(POD_ROUTE));

  it('อัปโหลดไฟล์ไม่สำเร็จ ตอบ 500 และไม่บันทึก metadata', () => {
    const code = route();
    const errIdx = code.indexOf('if (uploadError)');
    const insertIdx = code.indexOf(".from('pod_uploads')");
    assert.ok(errIdx !== -1 && errIdx < insertIdx, 'ต้องจบตั้งแต่อัปโหลดล้ม');
    assert.match(code.slice(errIdx, insertIdx), /return NextResponse\.json/);
  });

  it('บันทึก metadata ไม่สำเร็จ ต้องลบไฟล์ที่อัปโหลดไปแล้วทิ้ง', () => {
    const code = route();
    const idx = code.indexOf('if (insertError');
    assert.ok(idx !== -1, 'ต้องตรวจผลการบันทึก metadata');
    const block = code.slice(idx, idx + 500);
    assert.match(block, /\.remove\(\[storagePath\]\)/, 'ต้องเก็บกวาดไฟล์กำพร้า');
    assert.match(block, /status:\s*500/);
  });

  it('ไม่มีการเปลี่ยนสถานะ order ในเส้นทางอัปโหลด', () => {
    const code = route();
    assert.ok(
      !/\.from\('orders'\)[\s\S]{0,200}\.update\(/.test(code),
      'การอัปโหลดรูปต้องไม่ทำให้งานเปลี่ยนสถานะเอง'
    );
    assert.ok(!/completed/.test(code), 'route อัปโหลดต้องไม่ยุ่งกับสถานะ completed');
  });
});

describe('ปิดงานต้องผ่าน RPC ตัวเดียว ไม่เขียนสถานะเอง', () => {
  const route = () => stripTs(source(EVENT_ROUTE));

  it('เรียก finalize_rider_delivery_event และส่ง pod_id ต่อไป', () => {
    const code = route();
    assert.match(code, /rpc\('finalize_rider_delivery_event'/);
    assert.match(code, /p_pod_id:/);
  });

  it('route ไม่อัปเดตตาราง orders เอง', () => {
    const code = route();
    assert.ok(
      !/\.from\('orders'\)[\s\S]{0,200}\.update\(/.test(code),
      'สถานะต้องถูกเปลี่ยนในฐานข้อมูลที่เดียว เพื่อให้ล็อกและกฎอยู่ครบ'
    );
  });
});

describe('ฝั่งไรเดอร์: อัปโหลดล้มต้องไม่ปิดงานหลอก', () => {
  it('หยุดก่อนส่ง event ถ้า POD ยังไม่สำเร็จ', () => {
    const code = stripTs(source(RIDER_CLIENT));
    const podIdx = code.indexOf('/pod`');
    const guardIdx = code.indexOf('if (!podRes.ok || !podData.pod_id)', podIdx);
    const eventIdx = code.indexOf('/event`', podIdx);

    assert.ok(podIdx !== -1 && guardIdx !== -1 && eventIdx !== -1);
    assert.ok(guardIdx < eventIdx, 'ต้องตรวจผล POD ก่อนจะยิง event ปิดงาน');
    assert.match(
      code.slice(guardIdx, eventIdx),
      /return;/,
      'ต้อง return ออกไป ไม่ใช่เดินต่อไปปิดงาน'
    );
  });

  it('เปิดกล้องหรือคลังภาพบนมือถือได้', () => {
    assert.match(source(RIDER_CLIENT), /accept="image\/\*"/);
  });
});
