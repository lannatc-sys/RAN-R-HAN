import fs from 'fs';
import path from 'path';

// Load .env.local into process.env before importing modules that need it
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const { updateShopGeoAction } = await import('../src/app/actions/settings');
  const { createAdminClient } = await import('../src/lib/supabase/admin');

  const shopId = '9ba07a9c-3ef7-4de8-a632-03680c38ca9d'; // ครัวป้าแดง
  const lat = 19.3005; // ตลาดเก่า เทศบาลเมืองแม่ฮ่องสอน
  const lng = 97.9678;

  console.log(`Setting shop coordinates for ครัวป้าแดง via updateShopGeoAction...`);
  const res = await updateShopGeoAction({
    shop_id: shopId,
    shop_lat: lat,
    shop_lng: lng,
  });

  console.log('Action response:', res);
  if (!res.success) {
    throw new Error(`Failed to update shop geo: ${res.error}`);
  }

  // Verify directly from database
  const admin = createAdminClient();
  const { data: shop, error } = await admin
    .from('shops')
    .select('id, name, slug, shop_lat, shop_lng')
    .eq('id', shopId)
    .single();

  if (error) throw error;
  console.log('Verified shop in database:', shop);

  if (Number(shop.shop_lat) === lat && Number(shop.shop_lng) === lng) {
    console.log('✅ Step 2 Complete: Shop coordinates verified in database!');
  } else {
    throw new Error('Verification failed: Coordinates mismatch');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
