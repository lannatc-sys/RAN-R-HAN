/**
 * Cron Dispatch Timeout Regression Tests
 * ทดสอบความปลอดภัยและความถูกต้องของระบบจัดการ dispatch offer timeout
 * ใช้ Node.js built-in test runner + assert
 */

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

describe('Cron Dispatch Timeout System', () => {
  describe('Security & Authentication', () => {
    it('ตรวจสอบว่า route มีการตรวจสอบ CRON_SECRET', () => {
      const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

      assert(routeContent.includes('CRON_SECRET'), 'route ควรมีการตรวจสอบ CRON_SECRET');
      assert(routeContent.includes('process.env.CRON_SECRET'), 'route ควรอ่าน env CRON_SECRET');
      assert(routeContent.includes('Bearer ${cronSecret}'), 'route ควรตรวจสอบ Bearer token');
    });

    it('ตรวจสอบว่า route ปฏิเสธ request ที่ไม่มี auth', () => {
      const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

      assert(routeContent.includes('authHeader'), 'route ควรอ่าน auth header');
      assert(routeContent.includes("authHeader !== `Bearer ${cronSecret}`"), 'route ควรตรวจสอบ Bearer token');
      assert(routeContent.includes('401'), 'route ควรคืน 401 เมื่อ auth ล้มเหลว');
    });
  });

  describe('Idempotency & Concurrency Safety', () => {
    it('ตรวจสอบว่า RPC ใช้ advisory lock', () => {
      const migrationContent = readProjectFile(
        'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
      );

      assert(migrationContent.includes('pg_try_advisory_xact_lock'), 'RPC ควรใช้ advisory lock');
      assert(migrationContent.includes('advisory lock'), 'RPC ควรระบุการใช้ advisory lock ใน comment');
    });

    it('ตรวจสอบว่า RPC ใช้ FOR UPDATE', () => {
      const migrationContent = readProjectFile(
        'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
      );

      assert(migrationContent.includes('for update'), 'RPC ควรใช้ FOR UPDATE กับแถวที่กำลังประมวลผล');
    });
  });

  describe('Database as Authority', () => {
    it('ตรวจสอบว่า RPC ใช้ timestamp จากฐานข้อมูล', () => {
      const migrationContent = readProjectFile(
        'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
      );

      assert(
        migrationContent.includes('now()') && migrationContent.includes('v_now') && migrationContent.includes('timestamptz'),
        'RPC ควรใช้ now() ของฐานข้อมูล และเก็บในตัวแปร v_now'
      );
      assert(migrationContent.includes('timeout_at <'), 'RPC ควรเทียบ timeout_at กับ timestamp ปัจจุบัน');
    });

    it('ตรวจสอบว่า RPC ใช้ Compare-and-Swap', () => {
      const migrationContent = readProjectFile(
        'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
      );

      assert(
        migrationContent.includes("and status = 'offered'"),
        'RPC ควรใช้ WHERE status = offered สำหรับ Compare-and-Swap'
      );
    });
  });

  describe('Error Handling & Logging', () => {
    it('ตรวจสอบว่า RPC จัดการ error แยกแต่ละแถว', () => {
      const migrationContent = readProjectFile(
        'supabase/migrations/20260912000001_dispatch_timeout_atomic.sql'
      );

      assert(migrationContent.includes('exception'), 'RPC ควรมี exception block');
      assert(migrationContent.includes('v_errors'), 'RPC ควรนับจำนวน error');
      assert(migrationContent.includes('sqlerrm'), 'RPC ควรบันทึก error message');
    });

    it('ตรวจสอบว่า action มีการ log ผลลัพธ์', () => {
      const actionContent = readProjectFile('src/app/actions/dispatch.ts');

      assert(actionContent.includes('console.log'), 'action ควร log ผลลัพธ์');
      assert(actionContent.includes('[dispatch/cron]'), 'action ควรใช้ tag ที่สอดคล้องกัน');
      assert(actionContent.includes('expired='), 'action ควร log จำนวน expired');
      assert(actionContent.includes('redispatched='), 'action ควร log จำนวน redispatched');
      assert(actionContent.includes('errors='), 'action ควร log จำนวน errors');
    });

    it('ตรวจสอบว่า route มีการ log ผลลัพธ์', () => {
      const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

      assert(routeContent.includes('console.log'), 'route ควร log ผลลัพธ์');
      assert(routeContent.includes('[cron/dispatch-timeout]'), 'route ควรใช้ tag ที่สอดคล้องกัน');
    });
  });

  describe('Fallback Safety Net', () => {
    it('ตรวจสอบว่า dispatchOrderAction ยังคงมี fallback call', () => {
      const dispatchContent = readProjectFile('src/app/actions/dispatch.ts');

      assert(
        dispatchContent.includes('await timeoutOfferAction()'),
        'dispatchOrderAction ควร still เรียก timeoutOfferAction เป็น fallback'
      );
    });
  });

  describe('Response Format', () => {
    it('ตรวจสอบว่า response มี expired, redispatched, errors', () => {
      const routeContent = readProjectFile('src/app/api/cron/dispatch-timeout/route.ts');

      assert(routeContent.includes('expired:'), 'response ควรระบุ expired count');
      assert(routeContent.includes('redispatched:'), 'response ควรมี redispatched count');
      assert(routeContent.includes('errors:'), 'response ควรระบุ errors count');
    });
  });
});
