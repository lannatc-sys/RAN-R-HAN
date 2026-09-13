-- ==============================================================================
-- Migration: 20260913000001_secure_payment_slips_storage_policy.sql
-- Description: Restrict reading payment slips to authenticated users who have
--              access to the owning shop (has_shop_access), preventing cross-tenant
--              leakage of financial and customer transfer data.
-- ==============================================================================

-- Drop the overly permissive policy that allowed any authenticated user to view all slips
drop policy if exists "Staff can view payment slips" on storage.objects;

-- Recreate policy requiring shop access based on the shop_id folder in storage path:
-- Path convention: <shop_id>/<order_id>_<timestamp>.<ext>
create policy "Staff can view payment slips"
    on storage.objects for select
    using (
        bucket_id = 'payment-slips'
        and auth.role() = 'authenticated'
        and (
            (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and public.has_shop_access(((storage.foldername(name))[1])::uuid)
        )
    );
