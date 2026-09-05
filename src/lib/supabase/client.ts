import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://hqfzahyvwsjrvlgvaxda.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_HLIHXc9dap3u-6_mlwdFqw_u_LRiwa2';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
