#!/usr/bin/env node
/**
 * Verify Payment RPC Lockdown
 * Migration: 20260912000002_lock_down_payment_rpc.sql
 * 
 * Purpose: Lock down verify_and_confirm_payment() RPC
 * to prevent unauthorized payment confirmation
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment
const projectRoot = path.dirname(path.dirname(__filename));
const envPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set');
  console.error('Run this script from the project root with .env.local present');
  process.exit(1);
}

async function main() {
  console.log('=== Payment RPC Lockdown Verification ===\n');

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    let allPassed = true;

    // 1. Verify function exists
    console.log('1. Checking verify_and_confirm_payment function...');
    const funcResult = await client.query(`
      SELECT 
        proname,
        prosecdef as is_security_definer,
        pg_get_functiondef(oid) as function_def
      FROM pg_proc pr
      JOIN pg_namespace ns ON pr.pronamespace = ns.oid
      WHERE proname = 'verify_and_confirm_payment' 
        AND ns.nspname = 'public'
    `);

    if (funcResult.rows.length === 0) {
      console.log('   ✗ Function NOT FOUND');
      console.log('   → Migration 20260912000002 has NOT been applied to this database');
      console.log('   → Apply migration or verify against correct database\n');
      process.exit(1);
    }

    const func = funcResult.rows[0];
    console.log(`   ✓ Function exists: ${func.proname}`);
    console.log(`   ✓ SECURITY DEFINER: ${func.is_security_definer ? 'YES' : 'NO'}`);

    // 2. Verify search_path is pinned
    const hasSearchPath = func.function_def?.includes('SET search_path = public, extensions');
    console.log(`   ${hasSearchPath ? '✓' : '✗'} search_path pinned`);

    // 3. Verify privileges
    console.log('\n2. Verifying execute privileges...');
    const privResults = await client.query(`
      SELECT 
        'service_role' as role,
        has_function_privilege('service_role', 'public.verify_and_confirm_payment(uuid, numeric, text, jsonb)', 'execute') as has_priv
      UNION ALL
      SELECT 'anon', has_function_privilege('anon', 'public.verify_and_confirm_payment(uuid, numeric, text, jsonb)', 'execute')
      UNION ALL
      SELECT 'authenticated', has_function_privilege('authenticated', 'public.verify_and_confirm_payment(uuid, numeric, text, jsonb)', 'execute')
    `);

    const privMap = Object.fromEntries(
      privResults.rows.map(r => [r.role, r.has_priv])
    );

    if (!privMap.service_role) {
      console.log('   ✗ CRITICAL: service_role CANNOT execute the function');
      console.log('   → This will BREAK payment processing in production');
      allPassed = false;
    } else {
      console.log('   ✓ service_role: allowed (required for payment processing)');
    }

    if (privMap.anon) {
      console.log('   ✗ WARNING: anon STILL has execute privilege');
      console.log('   → Migration did not fully revoke anon access');
      allPassed = false;
    } else {
      console.log('   ✓ anon: properly denied');
    }

    if (privMap.authenticated) {
      console.log('   ✗ WARNING: authenticated STILL has execute privilege');
      console.log('   → Migration did not fully revoke authenticated access');
      allPassed = false;
    } else {
      console.log('   ✓ authenticated: properly denied');
    }

    // 4. Verify trigger functions have search_path pinned
    console.log('\n3. Checking trigger functions...');
    for (const funcName of ['handle_updated_at', 'generate_order_no']) {
      const tfResult = await client.query(`
        SELECT pg_get_functiondef(oid) as def
        FROM pg_proc pr
        JOIN pg_namespace ns ON pr.pronamespace = ns.oid
        WHERE pr.proname = '${funcName}' AND ns.nspname = 'public'
      `);
      
      if (tfResult.rows.length > 0) {
        const hasPinned = tfResult.rows[0].def?.includes('SET search_path = public, extensions');
        console.log(`   ${hasPinned ? '✓' : '⚠'} ${funcName}: ${hasPinned ? 'search_path pinned' : 'not pinned'}`);
      } else {
        console.log(`   ℹ ${funcName}: not found`);
      }
    }

    // Summary
    console.log('\n=== Verification Summary ===');
    if (allPassed) {
      console.log('✅ ALL CHECKS PASSED');
      console.log('Migration 20260912000002 correctly locks down verify_and_confirm_payment');
      console.log('✓ service_role can execute (payment processing works)');
      console.log('✓ anon/authenticated are denied (security enforced)');
    } else {
      console.log('⚠ SOME CHECKS FAILED');
      console.log('Review the warnings above before deploying to production');
    }

    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Error during verification:', err.message);
    if (err.code === '42501') {
      console.error('Permission denied (42501) - check database roles');
    } else if (err.code === '22003' || err.code === '22004') {
      console.error('Numeric error - check function arguments');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();