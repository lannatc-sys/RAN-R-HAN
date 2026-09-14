import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ปิด dispatch offer ที่หมดเวลา แล้วคืนออเดอร์กลับเป็น pending
 *
 * อยู่ใน lib ไม่ใช่ไฟล์ `'use server'` โดยตั้งใจ — ฟังก์ชันนี้เรียก admin client
 * และจับ advisory lock โดยไม่มีการตรวจสิทธิ์ในตัวเอง ถ้าอยู่ในไฟล์ server action
 * ทุก export จะกลายเป็น endpoint สาธารณะที่ใครก็ยิงได้
 * ผู้เรียกที่ถูกต้องคือ `/api/cron/dispatch-timeout` ซึ่งตรวจ CRON_SECRET ก่อน
 */
export async function expireDispatchOffers(): Promise<{ timed_out: number; redispatched: number; errors: number }> {
  const adminClient = createAdminClient();

  // ใช้ RPC expire_dispatch_offers() แทนการ Query/direct update
  // RPC นี้ใช้ advisory lock + FOR UPDATE เพื่อป้องกัน concurrent run
  // และคืน summary (expired/redispatched/errors) สำหรับ logging
  // SECURITY: function นี้ restricted ให้ service_role เท่านั้น (migration 20260912000001)
  const { data, error } = await adminClient
    .rpc('expire_dispatch_offers')
    .single();

  // CRITICAL: ห้ามกลืน infrastructure/RPC failure
  // - error ที่เป็น "function does not exist" หรือ "permission denied" = ปัญหาที่ต้อง fix ทันที
  // - error ที่เป็น network/timeout = transient, แต่ยังต้อง report ข upward
  if (error) {
    const errorMessage = error.message || String(error);
    console.error('[dispatch] expire_dispatch_offers RPC call failed:', errorMessage);

    // แยกกรณี permission error ออกมาเด่นชัด — มักหมายถึง migration ไม่ได้รัน
    if (errorMessage.includes('permission denied') || errorMessage.includes('does not exist')) {
      console.error(
        '[dispatch] CRITICAL: expire_dispatch_offers() ไม่สามารถเรียกใช้ได้ — ตรวจสอบว่า migration 20260912000001 ถูก apply แล้ว และ service_role มี GRANT EXECUTE'
      );
    }

    // Throw error ขึ้นไปให้ route จัดการ — ไม่ swallow
    throw new Error(`expire_dispatch_offers RPC failed: ${errorMessage}`);
  }

  const result = (data as any) || {};
  const timed_out = result.expired_count || 0;
  const redispatched = result.redispatched_count || 0;
  const errors = result.error_count || 0;

  console.log(
    `[dispatch/cron] expire_dispatch_offers result: expired=${timed_out}, redispatched=${redispatched}, errors=${errors}, run_at=${result.run_at}`
  );

  return { timed_out, redispatched, errors };
}
