import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service Role client สำหรับงานฝั่ง Backend ที่ต้องการ bypass RLS (เช่น Webhook, Web Push, Internal Jobs)
 * ห้าม expose key หรือ client นี้ไปยังฝั่ง Browser เด็ดขาด
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
