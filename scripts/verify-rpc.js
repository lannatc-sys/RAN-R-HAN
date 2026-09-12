#!/usr/bin/env node
/**
 * RPC Verification Script — Supabase-compatible
 * ตรวจสอบว่า expire_dispatch_offers() function มีอยู่จริงในฐานข้อมูล
 */

const { Client } = require('pg');
const path = require('path');
const { readFileSync } = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Set it in .env or environment.');
  process.exit(1);
}

async function main() {
  console.log('=== RPC Verification: expire_dispatch_offers() ===\n');

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database\n');

    // 1. ตรวจสอบว่ามี function อยู่จริงไหม
    console.log('1. Checking function existence in pg_proc...');
    const funcResult = await client.query(`
      SELECT pr.proname, pr.prorettype::regtype, pr.prosecdef,
             pg_get_functiondef(pr.oid) as function_def,
             obj_description(pr.oid, 'pg_proc') as comment
      FROM pg_proc pr
      JOIN pg_namespace ns ON pr.pronamespace = ns.oid
      WHERE pr.proname = 'expire_dispatch_offers'
        AND ns.nspname = 'public'
    `);

    if (funcResult.rows.length === 0) {
      console.log('  ✗ Function expire_dispatch_offers NOT found in public schema');
      process.exit(1);
    }

    const func = funcResult.rows[0];
    console.log(`  ✓ Function: ${func.proname}`);
    console.log(`  ✓ Schema: public`);
    console.log(`  ✓ Returns set: ${func.prorettype.includes('setof')}`);
    console.log(`  ✓ SECURITY DEFINER: ${func.prosecdef}`);

    // 2. ตรวจสอบ SECURITY DEFINER
    console.log('\n2. Verifying SECURITY DEFINER...');
    if (!func.prosecdef) {
      console.log('  ✗ FAIL: Function is NOT SECURITY DEFINER');
      process.exit(1);
    }
    console.log('  ✓ PASS: Function is SECURITY DEFINER');

    // 3. ทดสอบ execute function
    console.log('\n3. Testing function execution...');
    const execResult = await client.query('SELECT * FROM public.expire_dispatch_offers()');
    console.log('  ✓ Function executed successfully');
    console.log(`  Rows returned: ${execResult.rows.length}`);

    if (execResult.rows.length > 0) {
      const row = execResult.rows[0];
      console.log(`  expired_count: ${row.expired_count}`);
      console.log(`  redispatched_count: ${row.redispatched_count}`);
      console.log(`  error_count: ${row.error_count}`);
      console.log(`  run_at: ${row.run_at}`);
    }

    // 4. ตรวจสอบ privilege
    console.log('\n4. Checking execute privileges...');
    const privResult = await client.query(`
      SELECT has_function_privilege('${process.env.PG_USER || 'postgres'}', 'public.expire_dispatch_offers()', 'execute') as can_execute
    `);
    console.log(`  postgres execute privilege: ${privResult.rows[0].can_execute}`);

    // 5. ตรวจสอบ function comment
    console.log('\n5. Checking function comment...');
    if (!func.comment) {
      console.log('  ✗ No comment found');
      process.exit(1);
    }
    console.log(`  ✓ Comment exists: ${func.comment.substring(0, 100)}...`);

    // 6. ตรวจสอบ implementation สำคัญ
    console.log('\n6. Checking function implementation...');
    const funcDef = func.function_def || '';

    const checks = [
      { name: 'Advisory lock (pg_try_advisory_xact_lock)', test: funcDef.includes('pg_try_advisory_xact_lock') },
      { name: 'SET search_path', test: funcDef.includes('SET search_path') },
      { name: 'FOR UPDATE', test: funcDef.includes('FOR UPDATE') },
      { name: 'EXCEPTION handler', test: funcDef.includes('EXCEPTION') },
    ];

    for (const check of checks) {
      console.log(`  ${check.test ? '✓' : '✗'} ${check.name}: ${check.test}`);
      if (!check.test) {
        console.log(`    (missing from function definition)`);
      }
    }

    // สรุป
    console.log('\n=== Verification Summary ===');
    const allPassed = func.prosecdef && execResult.rows.length >= 0 &&
                     privResult.rows[0].can_execute && func.comment &&
                     checks.every(c => c.test);

    if (allPassed) {
      console.log('✓ Function exists in pg_proc: PASS');
      console.log('✓ SECURITY DEFINER: PASS');
      console.log('✓ Function callable: PASS');
      console.log('✓ Execute privilege: PASS');
      console.log('✓ Advisory lock: PASS');
      console.log('✓ search_path SET: PASS');
      console.log('✓ FOR UPDATE: PASS');
      console.log('✓ EXCEPTION handler: PASS');
    } else {
      console.log('⚠ Some checks failed — review above');
    }

    console.log('\n=== RPC Verification Complete ===');

    if (!allPassed) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Error during verification:', err.message);
    if (err.code === '42501') {
      console.error('→ Permission denied (42501): function may not be SECURITY DEFINER or grant missing');
    } else if (err.code === '22003' || err.code === '22004') {
      console.error('→ Numeric/value error — check function arguments');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
