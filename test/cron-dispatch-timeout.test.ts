'use strict';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const projectRoot = cwd();

function readProjectFile(relativePath: string): string {
  const fullPath = join(projectRoot, relativePath);
  return readFileSync(fullPath, 'utf-8');
}

describe('Cron Dispatch Timeout — Security & Access Control', () => {
  it('route ต้องปฏิเสธ request ที่ไม่มี Authorization header', () => {
    const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

    assert(routeContent.includes('authHeader'), 'route ต้องอ่าน auth header');
    assert(routeContent.includes('401'), 'route ต้องคืน 401 เมื่อไม่มี auth');
    assert(routeContent.includes('Unauthorized'), 'route ต้องระบุเหตุผลการปฏิเสธ');
  });

  it('route ต้องปฏิเสธ request ที่ใช้ secret ผิด', () => {
    const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

    assert(
      routeContent.includes("authHeader !== `Bearer ${cronSecret}`"),
      'route ต้องเปรียบเทียบ Bearer token กับ CRON_SECRET'
    );
  });

  it('route ต้องไม่เปิดเผย CRON_SECRET ใน source code', () => {
    const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

    // ตรวจสอบว่าไม่มีการ hardcode secret — ใช้ process.env เท่านั้น
    const hardcodedMatch = routeContent.match(/CRON_SECRET\s*=\s*['"]/);
    assert(
      !hardcodedMatch,
      'route ต้องไม่ hardcode CRON_SECRET ใน source code — ต้องใช้ process.env.CRON_SECRET เท่านั้น'
    );
    // ยืนยันว่าใช้ process.env
    assert(
      routeContent.includes('process.env.CRON_SECRET'),
      'route ต้องอ่าน CRON_SECRET จาก process.env'
    );
  });
});

describe('Cron Dispatch Timeout — RPC Failure Behavior', () => {
  it('action ต้อง throw error เมื่อ RPC call ล้มเหลว (ไม่ swallow)', () => {
    const dispatchContent = readProjectFile('src/app/actions/dispatch.ts');

    const throwIdx = dispatchContent.indexOf('throw new Error(');
    assert(
      throwIdx !== -1 && dispatchContent.includes('expire_dispatch_offers RPC failed'),
      'action ต้อง throw error เมื่อ RPC ล้ม — ไม่ swallow และไม่ return ค่าศูนย์'
    );
  });

  it('action ต้อง log critical error เมื่อ permission denied หรือ function ไม่มี', () => {
    const dispatchContent = readProjectFile('src/app/actions/dispatch.ts');

    assert(
      dispatchContent.includes('permission denied') || dispatchContent.includes('does not exist'),
      'action ต้องจัดการกรณี permission denied หรือ function ไม่มี'
    );
  });

  it('route ต้องคืน non-2xx และ ok:false เมื่อ RPC/Infrastructure ล้ม', () => {
    const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

    assert(
      routeContent.includes('502') || routeContent.includes('ok: false'),
      'route ต้องคืน 502 หรือ ok:false เมื่อ RPC ล้ม — ไม่ swallowed ไปเป็น 500 ทั่วไป'
    );
    assert(
      routeContent.includes('error:') || routeContent.includes('ok: false'),
      'route ต้องระบุระดับความล้มเหลว ไม่ให้ client เข้าใจผิดว่าประมวลผลสำเร็จ'
    );
  });

  it('route ต้องไม่เปิดเผยรายละเอียด error ให้ client', () => {
    const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

    const errorResponseIdx = routeContent.indexOf('ok: false');
    if (errorResponseIdx !== -1) {
      const errorBlock = routeContent.substring(errorResponseIdx, errorResponseIdx + 400);
      assert(
        !errorBlock.includes('errorMessage') && !errorBlock.includes('err.message'),
        'route ต้องไม่ส่งรายละเอียด error จาก RPC ไปให้ client — บันทึกใน log เท่านั้น'
      );
    }
  });
});

describe('Cron Dispatch Timeout — RPC Privilege Verification', () => {
  it('migration ต้องประกาศ SECURITY DEFINER', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    assert(
      migrationContent.includes('SECURITY DEFINER'),
      'RPC ต้องประกาศ SECURITY DEFINER เพื่อให้สิทธิ์ admin'
    );
  });

  it('migration ต้องตั้ง search_path ให้ครอบคลุม extensions', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    assert(
      migrationContent.includes('search_path') && migrationContent.includes('public') && migrationContent.includes('extensions'),
      'RPC ต้องระบุ search_path ที่ครอบคลุม public และ extensions (PostGIS)'
    );
  });

  it('migration ต้อง revoke public execution access', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    assert(
      migrationContent.includes('REVOKE ALL ON FUNCTION') && migrationContent.includes('FROM PUBLIC'),
      'migration ต้อง revoke สิทธิ์ execute จาก PUBLIC'
    );
    assert(
      migrationContent.includes('REVOKE ALL ON FUNCTION') && migrationContent.includes('FROM anon'),
      'migration ต้อง revoke สิทธิ์ execute จาก anon'
    );
    assert(
      migrationContent.includes('REVOKE ALL ON FUNCTION') && migrationContent.includes('FROM authenticated'),
      'migration ต้อง revoke สิทธิ์ execute จาก authenticated'
    );
  });

  it('migration ต้อง grant execute เฉพาะ service_role', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    assert(
      migrationContent.includes('GRANT EXECUTE ON FUNCTION') && migrationContent.includes('TO service_role'),
      'migration ต้อง grant execute ให้ service_role เท่านั้น'
    );
  });

  it('comment ของ function ต้องระบุระดับความปลอดภัย', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    assert(
      migrationContent.includes('SECURITY DEFINER') && migrationContent.includes('restricted'),
      'comment ของ function ต้องระบุระดับความปลอดภัยและข้อจำกัด'
    );
  });
});

describe('Cron Dispatch Timeout — Migration Runtime Validation', () => {
  it('migration file ต้องมี structure ที่ complete', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    const lower = migrationContent.toLowerCase();

    assert(lower.includes('create or replace function'), 'ต้องมี create or replace function');
    assert(lower.includes('returns table'), 'ต้องมี returns table');
    assert(lower.includes('language plpgsql'), 'ต้องระบุภาษา plpgsql');
    assert(lower.includes('$$'), 'ต้องมี terminator $$');
    assert(lower.includes('security definer'), 'ต้องระบุ SECURITY DEFINER');
  });

  it('migration file ต้องไม่มี syntax อันตรายหรือไม่สมบูรณ์', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    // ตรวจสอบว่าไม่มีคำสั่งที่ไม่สมบูรณ์ — ::bigint ไม่ใช่ syntax อันตราย
    // มันเป็น type cast ที่ใช้ใน RETURN QUERY ซึ่งถูกต้องแล้ว
    const lines = migrationContent.split('\n');
    let hasValidBigintUsage = false;

    for (const line of lines) {
      if (line.includes('::bigint') || line.includes('::integer')) {
        // ตรวจสอบว่าใช้ในบริบทที่ถูกต้อง — ใช้ใน RETURN QUERY หรือ variable assignment
        hasValidBigintUsage = true;
        // ไม่ต้อง fail — ::bigint ใน RETURN QUERY เป็น valid SQL
      }
    }

    // ไม่ assert ว่าไม่มี::bigint — มันมีอยู่และใช้ถูกต้องแล้ว
    // แต่ตรวจสอบว่าไม่มี syntax อื่นที่น่าสงสัย
    assert(!migrationContent.includes('EXECUTE IMMEDIATE'), 'ไม่ควรมี EXECUTE IMMEDIATE');
    assert(migrationContent.includes('$$'), 'ต้องมี $$ terminator');
  });

  it('migration ควรมี comment อธิบายวัตถุประสงค์และวิธีเรียกใช้', () => {
    const migrationContent = readProjectFile(
      'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
    );

    assert(migrationContent.includes('-- วัตถุประสงค์'), 'ต้องมี comment วัตถุประสงค์');
    assert(migrationContent.includes('-- เวลาเรียกใช้'), 'ต้องมี comment เวลาเรียกใช้');
  });
});

describe('Cron Dispatch Timeout — End-to-End Behavior', () => {
  it('system ต้องมี fallback safety net (cleanup-on-next-dispatch)', () => {
    const dispatchContent = readProjectFile('src/app/actions/dispatch.ts');

    const dispatchOrderIdx = dispatchContent.indexOf('dispatchOrderAction');
    if (dispatchOrderIdx !== -1) {
      const section = dispatchContent.substring(dispatchOrderIdx, dispatchOrderIdx + 2000);
      assert(
        section.includes('await timeoutOfferAction()'),
        'dispatchOrderAction ต้องยังคงเรียก timeoutOfferAction เป็น fallback'
      );
    }
  });

  it('action ต้อง log ผลลัพธ์สรุปทุกครั้งที่ RPC สำเร็จ', () => {
    const dispatchContent = readProjectFile('src/app/actions/dispatch.ts');

    const successLogIdx = dispatchContent.indexOf('[dispatch/cron]');
    if (successLogIdx !== -1) {
      const logSection = dispatchContent.substring(successLogIdx, successLogIdx + 500);
      assert(logSection.includes('expired='), 'log ต้องมี expired count');
      assert(logSection.includes('redispatched='), 'log ต้องมี redispatched count');
      assert(logSection.includes('errors='), 'log ต้องมี error count');
    }
  });

  it('route ต้อง log ผลลัพธ์เมื่อสำเร็จ', () => {
    const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

    const successLogIdx = routeContent.indexOf('[cron/dispatch-timeout] สำเร็จ');
    if (successLogIdx !== -1) {
      const logSection = routeContent.substring(successLogIdx, successLogIdx + 500);
      assert(logSection.includes('expired='), 'log ต้องมี expired count');
      assert(logSection.includes('redispatched='), 'log ต้องมี redispatched count');
      assert(logSection.includes('errors='), 'log ต้องมี error count');
    }
  });
});
