const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const envLine = fs
  .readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith('DATABASE_URL='));

if (!envLine) throw new Error('DATABASE_URL is missing from .env.local');

const connectionString = envLine.trim().slice('DATABASE_URL='.length);

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  try {
    const migrationFile = path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260912000004_rider_telegram_notification.sql'
    );
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('\n--- 1. Applying migration 20260912000004_rider_telegram_notification.sql ---');
    await client.query(sql);
    console.log('Migration applied successfully.');

    console.log('\n--- 2. Verifying Columns on public.riders ---');
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'riders'
        AND column_name IN ('telegram_chat_id', 'push_enabled');
    `);
    console.log('Columns found:', colsRes.rows);
    if (colsRes.rows.length < 2) {
      throw new Error('Verification failed: missing expected columns');
    }

    console.log('\n--- 3. Verifying Indexes on public.riders ---');
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'riders'
        AND indexname IN ('idx_riders_telegram_chat', 'idx_riders_telegram_chat_id');
    `);
    console.log('Indexes found:', idxRes.rows);
    if (idxRes.rows.length === 0) {
      throw new Error('Verification failed: missing expected index');
    }

    console.log('\n--- 4. Verifying Table Permissions ---');
    const permRes = await client.query(`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'riders'
        AND grantee IN ('authenticated', 'service_role')
      ORDER BY grantee, privilege_type;
    `);
    console.log('Permissions found:', permRes.rows);

    console.log('\n✅ Step 1 Verification Complete: Migration applied and verified successfully!');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});
