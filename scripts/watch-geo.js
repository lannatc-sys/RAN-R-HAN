#!/usr/bin/env node
/**
 * เฝ้าดูพิกัดไรเดอร์และการรับออเดอร์แบบเรียลไทม์ สำหรับทดสอบภาคสนาม
 *
 *   node scripts/watch-geo.js
 *
 * อ่าน DATABASE_URL จาก .env.local ของโปรเจกต์ ไม่ต้องส่งอะไรเพิ่ม
 * เป็นเครื่องมืออ่านอย่างเดียว ไม่เขียนอะไรลงฐานข้อมูลเลยสักคำสั่ง
 *
 * ทุกบรรทัดตอบคำถามเดียวคือ "ระบบตัดสินว่าอยู่ในเขตหรือนอกเขต และตัดสินด้วยอะไร"
 * แยกให้เห็นชัดว่าเป็นผลจาก polygon หรือจากรัศมี เพราะสองอย่างนี้ให้คำตอบ
 * ต่างกันได้ และเป็นจุดที่เทสภาคสนามต้องการพิสูจน์
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const REFRESH_MS = Number(process.env.WATCH_INTERVAL_MS || 3000);

function loadDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    ...[
      path.join(__dirname, '..', '.env.local'),
      'D:/system make/Ran-R-HAN/.env.local',
    ].map((file) => {
      if (!fs.existsSync(file)) return null;
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          return trimmed.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
        }
      }
      return null;
    }),
  ];
  const url = candidates.find(Boolean);
  if (!url) {
    console.error('ไม่พบ DATABASE_URL — ตั้ง env หรือวางไว้ใน .env.local');
    process.exit(1);
  }
  return url;
}

const RESET = '\x1b[0m';
const c = {
  dim: (s) => `\x1b[2m${s}${RESET}`,
  bold: (s) => `\x1b[1m${s}${RESET}`,
  green: (s) => `\x1b[32m${s}${RESET}`,
  red: (s) => `\x1b[31m${s}${RESET}`,
  yellow: (s) => `\x1b[33m${s}${RESET}`,
  cyan: (s) => `\x1b[36m${s}${RESET}`,
};

const SHOPS_SQL = `
  select id, name, shop_lat, shop_lng,
         coalesce(service_area_enabled, false) as enabled,
         service_radius_m, rider_work_radius_m,
         service_area_polygon is not null as has_customer_polygon,
         rider_work_area_polygon is not null as has_rider_polygon
    from public.shops
   order by enabled desc, name
`;

/**
 * ถามฐานข้อมูลด้วย predicate ตัวเดียวกับที่ระบบใช้ตัดสินจริง
 * ไม่คำนวณเองใน JS เพราะจะกลายเป็นการเดาแทนที่จะเป็นการตรวจ
 */
const RIDERS_SQL = `
  select r.display_name,
         r.phone,
         s.name as shop_name,
         l.lat, l.lng,
         l.updated_at,
         l.outside_area_since,
         ws.status::text as session_status,
         public.calc_distance_meters(s.shop_lat, s.shop_lng, l.lat, l.lng)::int as dist_m,
         s.rider_work_radius_m,
         s.rider_work_area_polygon is not null as has_polygon,
         coalesce(s.service_area_enabled, false) as enabled,
         public.is_point_in_shop_area(
           s.rider_work_area_polygon, s.shop_lat, s.shop_lng,
           s.rider_work_radius_m, l.lat, l.lng
         ) as in_area,
         public.is_point_in_shop_area(
           null, s.shop_lat, s.shop_lng,
           s.rider_work_radius_m, l.lat, l.lng
         ) as in_radius_only
    from public.rider_current_locations l
    join public.riders r on r.id = l.rider_id
    join public.shops s on s.id = l.shop_id
    left join public.rider_work_sessions ws on ws.id = l.work_session_id
   order by l.updated_at desc
   limit 12
`;

const ORDERS_SQL = `
  select o.order_no, o.type::text as type, o.status::text as status,
         o.created_at, o.delivery_lat, o.delivery_lng,
         s.name as shop_name,
         case when o.delivery_lat is null then null
              else public.calc_distance_meters(s.shop_lat, s.shop_lng, o.delivery_lat, o.delivery_lng)::int
         end as dist_m
    from public.orders o
    join public.shops s on s.id = o.shop_id
   where o.created_at > now() - interval '2 hours'
   order by o.created_at desc
   limit 8
`;

const hhmmss = (d) =>
  d ? new Date(d).toLocaleTimeString('th-TH', { hour12: false }) : '-';

const minutesSince = (d) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 60000) : null;

function renderShops(rows) {
  console.log(c.bold('ร้าน'));
  if (!rows.length) return console.log(c.dim('  ไม่มีข้อมูล'));
  for (const s of rows) {
    const pinned = s.shop_lat !== null && s.shop_lng !== null;
    const state = !pinned
      ? c.red('ยังไม่ปักหมุด')
      : s.enabled
        ? c.green('เปิดจำกัดพื้นที่')
        : c.red('ปิดอยู่ — ระบบจะไม่ตรวจอะไรเลย');
    const shapes = [
      s.has_customer_polygon ? c.cyan('polygon ลูกค้า') : c.dim('รัศมีลูกค้า'),
      s.has_rider_polygon ? c.cyan('polygon ไรเดอร์') : c.dim('รัศมีไรเดอร์'),
    ].join(' · ');
    console.log(
      `  ${s.name.padEnd(22)} ${state}  ${shapes}  ` +
        c.dim(`r=${s.service_radius_m ?? '-'}m / rider=${s.rider_work_radius_m ?? '-'}m`)
    );
  }
}

function renderRiders(rows) {
  console.log('');
  console.log(c.bold('ไรเดอร์ — พิกัดล่าสุด'));
  if (!rows.length) return console.log(c.dim('  ยังไม่มีไรเดอร์รายงานพิกัดเข้ามา'));

  for (const r of rows) {
    const age = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 1000);
    const stale = age > 90 ? c.red(`${age}s`) : age > 30 ? c.yellow(`${age}s`) : c.green(`${age}s`);

    let verdict;
    if (!r.enabled) {
      verdict = c.dim('ไม่ตรวจ (ร้านปิดการจำกัดพื้นที่)');
    } else if (r.in_area) {
      verdict = c.green('ในเขต');
    } else {
      verdict = c.red('นอกเขต');
    }

    // จุดที่ polygon กับรัศมีตอบไม่ตรงกัน คือหลักฐานว่า polygon มีผลจริง
    let why = '';
    if (r.enabled && r.has_polygon && r.in_area !== r.in_radius_only) {
      why = c.cyan(
        r.in_radius_only
          ? '  ← polygon ตัดออก ทั้งที่อยู่ในรัศมี'
          : '  ← polygon รับเข้า ทั้งที่นอกรัศมี'
      );
    }

    const mins = minutesSince(r.outside_area_since);
    const timer =
      mins === null
        ? c.dim('ไม่มีจับเวลา')
        : mins >= 15
          ? c.red(`นอกเขตมา ${mins} นาที — ครบกำหนดปิดแล้ว`)
          : c.yellow(`นอกเขตมา ${mins} นาที`);

    console.log(
      `  ${(r.display_name || '-').padEnd(16)} ${verdict.padEnd(24)} ` +
        `${String(r.dist_m).padStart(6)}m/${r.rider_work_radius_m}m  ` +
        `${timer}  ${c.dim(`session=${r.session_status || 'ไม่มี'}`)}  ${c.dim(`อัปเดต ${stale} ที่แล้ว`)}${why}`
    );
    console.log(c.dim(`      ${r.lat}, ${r.lng}   ร้าน: ${r.shop_name}`));
  }
}

function renderOrders(rows) {
  console.log('');
  console.log(c.bold('ออเดอร์ 2 ชั่วโมงล่าสุด'));
  if (!rows.length) return console.log(c.dim('  ยังไม่มี'));
  for (const o of rows) {
    const dist = o.dist_m === null ? c.dim('ไม่มีพิกัด') : `${o.dist_m}m`;
    console.log(
      `  ${hhmmss(o.created_at)}  ${String(o.order_no).padEnd(16)} ` +
        `${o.type.padEnd(9)} ${o.status.padEnd(11)} ${dist}  ${c.dim(o.shop_name)}`
    );
  }
  console.log(
    c.dim('  หมายเหตุ ออเดอร์ที่ถูกปฏิเสธเพราะนอกเขตจะไม่ถูกบันทึกลงตาราง จึงไม่ขึ้นที่นี่')
  );
}

async function main() {
  const client = new Client({
    connectionString: loadDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query('set session characteristics as transaction read only');

  let failures = 0;
  const tick = async () => {
    try {
      // client เดียวรัน query ซ้อนกันไม่ได้ pg เตือน deprecation ถ้ายิงพร้อมกัน
      const shops = await client.query(SHOPS_SQL);
      const riders = await client.query(RIDERS_SQL);
      const orders = await client.query(ORDERS_SQL);
      failures = 0;
      process.stdout.write('\x1b[2J\x1b[H');
      console.log(
        c.bold('RAN-R-HAN — เฝ้าดูพื้นที่ให้บริการแบบเรียลไทม์') +
          c.dim(`   ${new Date().toLocaleTimeString('th-TH', { hour12: false })}   อ่านอย่างเดียว`)
      );
      console.log(c.dim('─'.repeat(100)));
      renderShops(shops.rows);
      renderRiders(riders.rows);
      renderOrders(orders.rows);
      console.log('');
      console.log(c.dim(`รีเฟรชทุก ${REFRESH_MS / 1000} วินาที — Ctrl+C เพื่อออก`));
    } catch (err) {
      failures += 1;
      console.error(c.red(`อ่านข้อมูลไม่สำเร็จ (${failures}): ${err.message}`));
      if (failures >= 5) {
        console.error(c.red('ล้มติดกัน 5 ครั้ง หยุดทำงาน'));
        process.exit(1);
      }
    }
  };

  await tick();
  const timer = setInterval(tick, REFRESH_MS);

  const shutdown = async () => {
    clearInterval(timer);
    try {
      await client.end();
    } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('เริ่มการเฝ้าดูไม่สำเร็จ:', err.message);
  process.exit(1);
});
