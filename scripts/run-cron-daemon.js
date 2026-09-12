const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let cronSecret = process.env.CRON_SECRET;
let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (key === 'CRON_SECRET') cronSecret = val;
      if (key === 'NEXT_PUBLIC_APP_URL') baseUrl = val;
    }
  }
}

if (!cronSecret) {
  console.error('[CRON DAEMON ERROR] CRON_SECRET is missing');
  process.exit(1);
}

console.log(`[CRON DAEMON] Starting 1-minute interval scheduler for /api/cron/dispatch-timeout...`);

async function triggerCron() {
  try {
    const { GET } = require('../src/app/api/cron/dispatch-timeout/route');
    const { NextRequest } = require('next/server');

    const req = new NextRequest('http://localhost:3000/api/cron/dispatch-timeout', {
      headers: { authorization: `Bearer ${cronSecret}` },
    });

    const res = await GET(req);
    const data = await res.json();
    console.log(`[CRON DAEMON PING] ${new Date().toISOString()} -> Status: ${res.status}, Expired: ${data.expired}, Redispatched: ${data.redispatched}`);
  } catch (err) {
    console.error(`[CRON DAEMON PING ERROR] ${new Date().toISOString()} ->`, err.message);
  }
}

// Initial trigger
triggerCron();

// Schedule every 60,000 ms (1 minute)
setInterval(triggerCron, 60000);
