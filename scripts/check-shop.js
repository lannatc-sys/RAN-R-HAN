const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const envLine = fs
  .readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith('DATABASE_URL='));

const connectionString = envLine.trim().slice('DATABASE_URL='.length);

async function checkShop() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query("SELECT * FROM public.shops WHERE slug = 'krua-pa-daeng';");
    console.log('Shop details:', res.rows[0]);
  } finally {
    await client.end();
  }
}

checkShop().catch(console.error);
