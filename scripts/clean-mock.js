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
  console.error('ERROR: DATABASE_URL not found');
  process.exit(1);
}

async function cleanMockData() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL...');

    // ลบร้านค้าที่เป็น Mock / Sample / Test
    const deleteRes = await client.query(`
      DELETE FROM public.shops 
      WHERE slug = 'krua-khun-yai' 
         OR slug = 'shop-70ogj' 
         OR name ILIKE '%ครัวคุณยาย%' 
         OR name ILIKE '%Test Shop%';
    `);
    console.log(`Successfully deleted ${deleteRes.rowCount} mock shop(s).`);

    // ตรวจสอบจำนวนร้านค้าที่เหลือในระบบ
    const shopsRes = await client.query('SELECT id, name, slug, status FROM public.shops;');
    console.log(`\nRemaining shops in database: ${shopsRes.rowCount}`);
    shopsRes.rows.forEach((s) => {
      console.log(` - [${s.slug}] ${s.name} (${s.status})`);
    });

    // ตรวจสอบตารางที่เกี่ยวข้อง
    const tables = ['shops', 'categories', 'menu_items', 'options', 'tables', 'orders', 'payments'];
    console.log('\nTable counts:');
    for (const t of tables) {
      const res = await client.query(`SELECT COUNT(*) as count FROM public.${t};`);
      console.log(` - ${t}: ${res.rows[0].count}`);
    }

    console.log('\nAll mock shops and associated sample data have been cleanly removed! ✅');
  } catch (err) {
    console.error('Error cleaning mock data:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanMockData();
