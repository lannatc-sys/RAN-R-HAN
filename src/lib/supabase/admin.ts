import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service Role client สำหรับงานฝั่ง Backend ที่ต้องการ bypass RLS (เช่น Webhook, Web Push, Internal Jobs)
 * ห้าม expose key หรือ client นี้ไปยังฝั่ง Browser เด็ดขาด
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://hqfzahyvwsjrvlgvaxda.supabase.co';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY). Copy the `secret` key from Supabase Dashboard → Settings → API Keys into .env.local / Vercel env.'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
