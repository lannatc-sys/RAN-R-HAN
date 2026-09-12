const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// อ่าน DATABASE_URL จาก .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let connectionString = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      connectionString = trimmed.substring('DATABASE_URL='.length).trim();
      break;
    }
  }
}

if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set in environment or .env.local');
  process.exit(1);
}

// Postgres error codes for "already exists" — safe to skip when re-running this
// script against a database that has already had some/all migrations applied.
// (CREATE TABLE/FUNCTION in these migrations already use IF NOT EXISTS / OR REPLACE,
// but CREATE POLICY and a few other DDL statements have no idempotent form.)
const ALREADY_EXISTS_CODES = new Set([
  '42710', // duplicate_object (e.g. CREATE POLICY, CREATE TYPE without a guard)
  '42P07', // duplicate_table
  '42723', // duplicate_function
  '42701', // duplicate_column
]);

async function runMigrationFile(client, migrationsDir, fileName, stepLabel, successMessage) {
  const filePath = path.join(migrationsDir, fileName);
  if (!fs.existsSync(filePath)) return;

  console.log(`${stepLabel} Executing supabase/migrations/${fileName}...`);
  try {
    await client.query(fs.readFileSync(filePath, 'utf-8'));
    console.log(`   [SUCCESS] ${successMessage}\n`);
  } catch (err) {
    if (ALREADY_EXISTS_CODES.has(err.code)) {
      console.log(`   [SKIPPED] Already applied (${err.code}: ${err.message}).\n`);
    } else {
      throw err;
    }
  }
}

async function runDatabaseSetup() {
  console.log('Connecting to PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  try {
    await client.connect();
    console.log('Connected successfully to Supabase PostgreSQL.\n');

    await runMigrationFile(client, migrationsDir, 'run_all.sql', '1.', 'Initial schema, types, and RLS applied.');
    await runMigrationFile(client, migrationsDir, '20260906000001_pickup_mvp.sql', '1.1', 'Pickup MVP schema, kds_pin, credentials, and RPC applied.');
    await runMigrationFile(client, migrationsDir, '20260910000001_delivery_system.sql', '1.2', 'Delivery & Preorder schema and default locations applied.');
    await runMigrationFile(client, migrationsDir, '20260910000002_legal_pdpa_compliance.sql', '1.3', 'Legal & PDPA compliance schema applied.');
    await runMigrationFile(client, migrationsDir, '20260910000003_telegram_notifications.sql', '1.4', 'Telegram notifications & link tokens schema applied.');

    // 1.5-1.10 Rider system migrations, in order (tables dispatch_offers/orders.dispatch_status
    // etc. come from these — 20260912000001 below depends on them and will fail without this)
    const riderMigrations = [
      '20260911000001_rider_system.sql',
      '20260911000002_rider_rls.sql',
      '20260911000003_rider_rpc_functions.sql',
      '20260911000004_rider_storage_and_shop_geo.sql',
      '20260911000005_rider_p0_hardening.sql',
      '20260911000006_rider_concurrency_lock.sql',
    ];
    for (const [i, name] of riderMigrations.entries()) {
      await runMigrationFile(client, migrationsDir, name, `1.${5 + i}`, 'applied.');
    }

    await runMigrationFile(client, migrationsDir, '20260912000001_dispatch_timeout_atomic.sql', '1.11', 'Dispatch timeout RPC and security applied.');
    await runMigrationFile(client, migrationsDir, '20260912000002_lock_down_payment_rpc.sql', '1.12', 'Payment RPC lockdown applied.');
    await runMigrationFile(client, migrationsDir, '20260912000003_dispatch_order_lock.sql', '1.13', 'Dispatch order-scoped unique index applied.');
    await runMigrationFile(client, migrationsDir, '20260912000004_rider_telegram_notification.sql', '1.14', 'Rider telegram & push channels schema applied.');

    // 2. Run seed data (seed.sql) - Optional via --seed flag
    const shouldSeed = process.argv.includes('--seed');
    const seedPath = path.join(__dirname, '..', 'seed.sql');
    if (shouldSeed && fs.existsSync(seedPath)) {
      console.log('2. Executing seed.sql (Sample shop, menu, categories)...');
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      await client.query(seedSql);
      console.log('   [SUCCESS] Seed data applied successfully.\n');
    } else {
      console.log('2. Skipping seed data (Clean production schema mode. Use --seed to populate sample data).\n');
    }

    // 3. Verify Database Contents
    console.log('3. Verifying Database Tables:');
    const shopsRes = await client.query('SELECT id, name, slug, status, is_active FROM public.shops;');
    console.log(`   - Shops (${shopsRes.rowCount}):`);
    shopsRes.rows.forEach((s) => console.log(`     • [${s.slug}] ${s.name} (Status: ${s.status}, Active: ${s.is_active})`));

    const catsRes = await client.query('SELECT COUNT(*) as count FROM public.categories;');
    console.log(`   - Categories: ${catsRes.rows[0].count}`);

    const menusRes = await client.query('SELECT COUNT(*) as count FROM public.menu_items;');
    console.log(`   - Menu Items: ${menusRes.rows[0].count}`);

    const usersRes = await client.query('SELECT COUNT(*) as count FROM public.users;');
    console.log(`   - Users: ${usersRes.rows[0].count}`);

    console.log('\nDATABASE SETUP COMPLETE! All tables and seed data are ready. ✅');
  } catch (err) {
    console.error('Database setup error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runDatabaseSetup();
