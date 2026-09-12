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

async function testEndpoint() {
  const { GET } = await import('../src/app/api/cron/dispatch-timeout/route');
  const { NextRequest } = await import('next/server');

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error('CRON_SECRET is not configured in .env.local');
  }

  console.log('Testing /api/cron/dispatch-timeout authentication & response...');

  // 1. Test unauthorized
  const unauthReq = new NextRequest('http://localhost:3000/api/cron/dispatch-timeout', {
    headers: { authorization: 'Bearer invalid_secret_12345' },
  });
  const unauthRes = await GET(unauthReq);
  console.log('Unauthorized request HTTP status:', unauthRes.status);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for invalid secret, got ${unauthRes.status}`);
  }

  // 2. Test authorized request
  const authReq = new NextRequest('http://localhost:3000/api/cron/dispatch-timeout', {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const authRes = await GET(authReq);
  const authBody = await authRes.json();

  console.log('Authorized request HTTP status:', authRes.status);
  console.log('Authorized response body:', JSON.stringify(authBody, null, 2));

  if (authRes.status !== 200 || !authBody.ok) {
    throw new Error(`Expected 200 with ok: true, got ${authRes.status}: ${JSON.stringify(authBody)}`);
  }

  console.log('✅ Cron route authentication & execution verified successfully!');
}

testEndpoint().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
