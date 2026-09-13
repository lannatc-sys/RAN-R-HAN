-- Migration: 20260913000002_secure_payment_slips_upload_policy
-- Purpose: Replace permissive "Anyone can upload payment slips" INSERT policy on
--          storage.objects (bucket: payment-slips) with a hardened one that:
--   1. Requires the caller to be authenticated (no anon uploads)
--   2. Enforces path structure: first path segment must be a UUID belonging to
--      a shop the caller has access to (has_shop_access)
--   3. Limits individual file size to 10 MB

-- Drop existing permissive INSERT policy
drop policy if exists "Anyone can upload payment slips" on storage.objects;

-- Recreate with least-privilege: authenticated + shop ownership + path binding
create policy "Authenticated staff can upload payment slips to own shop folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-slips'
    -- Path must start with a valid shop_id UUID that the user can access
    and public.has_shop_access(((storage.foldername(name))[1])::uuid)
    -- Limit file size to 10 MB (metadata.size is in bytes)
    and (metadata->>'size')::bigint <= 10 * 1024 * 1024
  );
