import fs from 'fs';
import path from 'path';

// Load .env.local
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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ran-r-han.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

async function testEndpoint(name: string, endpointPath: string) {
  const url = `${BASE_URL}${endpointPath}`;
  console.log(`\n========================================`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`========================================`);

  // 1. No auth header -> Expect 401
  process.stdout.write('[1/3] Testing WITHOUT auth header... ');
  try {
    const resNoAuth = await fetch(url);
    if (resNoAuth.status === 401) {
      console.log(`✅ 401 Unauthorized (PASS)`);
    } else {
      console.log(`❌ Expected 401, got ${resNoAuth.status}`);
    }
  } catch (err: any) {
    console.log(`❌ Request failed: ${err.message}`);
  }

  // 2. Invalid secret -> Expect 401
  process.stdout.write('[2/3] Testing with INVALID secret... ');
  try {
    const resBadAuth = await fetch(url, {
      headers: { Authorization: 'Bearer bad_secret_99999' },
    });
    if (resBadAuth.status === 401) {
      console.log(`✅ 401 Unauthorized (PASS)`);
    } else {
      console.log(`❌ Expected 401, got ${resBadAuth.status}`);
    }
  } catch (err: any) {
    console.log(`❌ Request failed: ${err.message}`);
  }

  // 3. Valid secret -> Expect 200
  process.stdout.write(`[3/3] Testing with CRON_SECRET (${CRON_SECRET ? CRON_SECRET.slice(0, 8) + '...' : 'NOT_SET'})... `);
  if (!CRON_SECRET) {
    console.log(`❌ CRON_SECRET is missing in .env.local`);
    return;
  }

  try {
    const resGoodAuth = await fetch(url, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const body = await resGoodAuth.json().catch(() => ({}));
    if (resGoodAuth.status === 200) {
      console.log(`✅ 200 OK (PASS)`);
      console.log(`    Response:`, JSON.stringify(body));
    } else {
      console.log(`❌ Expected 200, got ${resGoodAuth.status}`);
      console.log(`    Response:`, JSON.stringify(body));
    }
  } catch (err: any) {
    console.log(`❌ Request failed: ${err.message}`);
  }
}

async function main() {
  console.log(`🔍 RAN-R-HAN Production Cron Verification Tool`);
  console.log(`Target Host: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await testEndpoint('1. Dispatch Timeout (Every 1 min)', '/api/cron/dispatch-timeout');
  await testEndpoint('2. Data Retention (Daily)', '/api/cron/data-retention');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
