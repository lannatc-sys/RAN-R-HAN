const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const getEnv = (key) => (envContent.match(new RegExp(key + '=(.*)')) || [])[1]?.trim();

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const databaseUrl = getEnv('DATABASE_URL');

if (!supabaseUrl || !serviceKey || !databaseUrl) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function uploadFile(bucket, storagePath, localPath) {
  const buffer = fs.readFileSync(localPath);
  const { data, error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (error) {
    throw error;
  }
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return pub.publicUrl;
}

async function main() {
  console.log('--- Uploading all images to Supabase Storage (shop-assets) ---');

  const shopsDir = path.join(__dirname, '..', 'public', 'images', 'shops');
  const menuDir = path.join(__dirname, '..', 'public', 'images', 'menu');

  const urlMap = {};

  // 1. Upload shop logos
  const shopFiles = fs.readdirSync(shopsDir).filter((f) => f.endsWith('.webp'));
  for (const file of shopFiles) {
    const storagePath = `demo/shops/${file}`;
    const pubUrl = await uploadFile('shop-assets', storagePath, path.join(shopsDir, file));
    urlMap[`/images/shops/${file}`] = pubUrl;
    console.log(`✓ Uploaded shop logo: ${file} -> ${pubUrl}`);
  }

  // 2. Upload menu items
  const menuFiles = fs.readdirSync(menuDir).filter((f) => f.endsWith('.webp'));
  for (const file of menuFiles) {
    const storagePath = `demo/menu/${file}`;
    const pubUrl = await uploadFile('shop-assets', storagePath, path.join(menuDir, file));
    urlMap[`/images/menu/${file}`] = pubUrl;
    console.log(`✓ Uploaded menu image: ${file} -> ${pubUrl}`);
  }

  console.log(`\nAll ${Object.keys(urlMap).length} images uploaded to Supabase Storage!`);

  // 3. Update database
  console.log('\n--- Updating Database URLs to Supabase Public CDN URLs ---');
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const [relPath, pubUrl] of Object.entries(urlMap)) {
    if (relPath.startsWith('/images/shops/')) {
      const res = await client.query('UPDATE shops SET logo_url = $1 WHERE logo_url = $2', [pubUrl, relPath]);
      if (res.rowCount > 0) {
        console.log(`Updated shop logo: ${relPath} -> ${pubUrl}`);
      }
    } else {
      const res = await client.query('UPDATE menu_items SET image_url = $1 WHERE image_url = $2', [pubUrl, relPath]);
      if (res.rowCount > 0) {
        console.log(`Updated menu_item (${res.rowCount} rows): ${relPath} -> ${pubUrl}`);
      }
    }
  }

  const check = await client.query(`
    SELECT
      (SELECT count(*) FROM shops WHERE logo_url LIKE 'https://%') as shops_with_cdn_logo,
      (SELECT count(*) FROM menu_items WHERE image_url LIKE 'https://%') as items_with_cdn_image
  `);
  console.log('DATABASE CDN VERIFICATION:', check.rows[0]);

  await client.end();
  console.log('DONE!');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
