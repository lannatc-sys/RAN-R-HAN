# Database Migration Verification Workflow
Use when verifying PostgreSQL migrations after applying them to Supabase.
Follow this procedure before reporting verification complete.

## Core Verification Steps

### 1. Syntax Validation
Always validate SQL syntax before running tests:
```bash
# For Node.js scripts using pg client
node scripts/validate-migration.js
```

### 2. RPC/Function Verification
Verify the function exists and has correct security properties:
```bash
# Run the verification script
node scripts/verify-rpc.js
```

Checklist:
- [ ] Function exists in `pg_proc` 
- [ ] `SECURITY DEFINER` properly declared
- [ ] `search_path` pinned to `public, extensions`
- [ ] Advisory lock implemented (`pg_try_advisory_xact_lock`)
- [ ] `FOR UPDATE` locking present
- [ ] EXCEPTION handler exists
- [ ] Proper REVOKE/GRANT to service_role only

### 3. Caller Privilege Verification
Never assume REVOKE/GRANT won't break existing callers:
```bash
# Check who can still call the function
psql "$DATABASE_URL" -c "
  SELECT 
    has_function_privilege('service_role', 'func_name()', 'execute') as service_role,
    has_function_privilege('anon', 'func_name()', 'execute') as anon,
    has_function_privilege('authenticated', 'func_name()', 'execute') as authenticated;
"
```

**Rule:** Verify that `service_role` CAN still execute the function after all REVOKE/GRANT statements. If it cannot, the migration breaks production code.

### 4. Test Execution
Run the full test suite:
```bash
# Unit tests for the specific migration
npx tsx --test "test/cron-dispatch-timeout.test.ts"

# All unit tests
npx tsx --test "test/*.test.ts"

# TypeScript check
npx tsc --noEmit

# Build verification
pnpm build
```

### 5. Git Diff Review
Before committing:
```bash
git diff --stat
git diff --check  # No whitespace errors
```

## Common Pitfalls

### Pitfall: REVOKE all does not distinguish service_role
Migration using `REVOKE ALL FROM public` also revokes from `service_role` if it inherits.
**Why:** service_role permissions in PostgREST are granted via role membership, and REVOKE from PUBLIC can interfere with inherited privileges. Always explicitly test that service_role can execute.

### Pitfall: Function not found after migration
Migration may fail silently if file syntax is invalid.
**Why:** Supabase migration runner catches errors but the function may not be created. Always verify function existence with a live database query.

### Pitfall: Test passes but endpoint fails in production
Tests may mock the database or run against a different environment.
**Why:** The test environment may not have the migration applied. Verify against the actual database before claiming production readiness.

## Environment Requirements

- `DATABASE_URL` must be set in `.env.local` for verification scripts
- Scripts read `.env.local` automatically, but verify the connection works:
```bash
node -e "require('pg').Client" && echo "pg module OK"
```

## Final Report Format

```markdown
## Migration Verification Complete ✅

| Check | Result |
|-------|--------|
| Syntax | PASS |
| Function Exists | PASS |
| SECURITY DEFINER | PASS |
| search_path | PASS |
| service_role Can Execute | PASS |
| Tests | PASS (N/N) |
| Build | PASS |

## Apply Instructions

**DO NOT** apply this migration manually. Use your standard Supabase deployment process:

1. Review the migration file: `supabase/migrations/<version>_migration_name.sql`
2. Apply via Supabase CLI: `supabase db push` 
3. **OR** let your CI/CD pipeline apply it automatically
4. Verify in production: check database schema and test endpoint with production credentials

**NOTE:** This migration requires `service_role` privileges. Ensure any backend service using `createAdminClient()` continues to work after deployment.

```