const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

async function enableAllSystems() {
  console.log('Connecting to PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database successfully.\n');

    // Update all existing shops
    const res = await client.query(`
      UPDATE public.shops
      SET
        plan = 'enterprise',
        is_active = true,
        status = 'active',
        allow_dine_in = true,
        allow_takeaway = true,
        allow_delivery = true,
        is_delivery_enabled = true,
        support_access_expires_at = NOW() + INTERVAL '30 days'
      RETURNING id, name, slug, plan, allow_dine_in, allow_takeaway, allow_delivery, is_delivery_enabled;
    `);

    console.log(`Updated ${res.rowCount} shops to full access:`);
    res.rows.forEach((s) => {
      console.log(`- [${s.slug}] ${s.name}:`);
      console.log(`    Plan: ${s.plan}`);
      console.log(`    Dine-in: ${s.allow_dine_in}, Takeaway: ${s.allow_takeaway}, Delivery: ${s.allow_delivery}`);
      console.log(`    Delivery Enabled: ${s.is_delivery_enabled}`);
    });

    console.log('\nAll systems enabled for all shops in the database! ✅');
  } catch (err) {
    console.error('Error enabling all systems:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

enableAllSystems();
