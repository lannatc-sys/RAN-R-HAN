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

async function runDatabaseSetup() {
  console.log('Connecting to PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected successfully to Supabase PostgreSQL.\n');

    // 1. Run migrations (run_all.sql)
    const runAllPath = path.join(__dirname, '..', 'supabase', 'migrations', 'run_all.sql');
    if (fs.existsSync(runAllPath)) {
      console.log('1. Executing supabase/migrations/run_all.sql...');
      const sql = fs.readFileSync(runAllPath, 'utf-8');
      await client.query(sql);
      console.log('   [SUCCESS] Schema, types, RLS, and RPC functions applied.\n');
    } else {
      console.log('   [SKIP] run_all.sql not found.\n');
    }

    // 2. Run seed data (seed.sql)
    const seedPath = path.join(__dirname, '..', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('2. Executing seed.sql (Sample shop, menu, categories)...');
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      await client.query(seedSql);
      console.log('   [SUCCESS] Seed data applied successfully.\n');
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
