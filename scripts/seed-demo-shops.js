// scripts/seed-demo-shops.js
// ล้างข้อมูลร้านค้าทั้งหมด แล้ว seed ร้าน mockup 2 ร้าน:
//   1. ครัวป้าแดง อาหารตามสั่ง (standard: dine-in + takeaway)
//   2. Slow Morn Coffee (basic: takeaway only)
// วิธีรัน: node scripts/seed-demo-shops.js --yes
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

if (!process.argv.includes('--yes')) {
  console.error('SAFETY: script นี้จะลบข้อมูล shops ทั้งหมด (TRUNCATE ... CASCADE)');
  console.error('ถ้าตั้งใจจริง ให้รัน: node scripts/seed-demo-shops.js --yes');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env.local');
let connectionString = process.env.DATABASE_URL;
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t.startsWith('DATABASE_URL=')) {
      connectionString = t.substring('DATABASE_URL='.length).trim();
      break;
    }
  }
}
if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const FOOD_OPTIONS = [
  { name: 'เพิ่มไข่ดาว', price_delta: 12 },
  { name: 'ทำเป็นพิเศษ', price_delta: 15 },
  { name: 'เผ็ดน้อย', price_delta: 0 },
];
const COFFEE_OPTIONS = [
  { name: 'เพิ่มช็อตเอสเพรสโซ่', price_delta: 15 },
  { name: 'เปลี่ยนเป็นนมโอ๊ต', price_delta: 20 },
  { name: 'หวานน้อย', price_delta: 0 },
];

const SHOPS = [
  {
    slug: 'krua-pa-daeng',
    name: 'ครัวป้าแดง อาหารตามสั่ง',
    phone: '081-234-5678',
    address: '123 ถนนตลาดเก่า ตำบลในเมือง อำเภอเมือง',
    promptpay_id: '0812345678',
    promptpay_name: 'ครัวป้าแดง',
    plan: 'standard',
    allow_dine_in: true,
    allow_takeaway: true,
    allow_delivery: false,
    categories: [
      {
        name: 'ข้าวราด & ผัด',
        items: [
          { name: 'ข้าวกะเพราหมูสับ', description: 'ผัดกะเพรารสจัด เสิร์ฟพร้อมข้าวสวยร้อนๆ', price: 60, options: FOOD_OPTIONS },
          { name: 'ข้าวกะเพราไก่', description: 'กะเพราไก่สับ เผ็ดหอมใบกะเพรา', price: 60, options: FOOD_OPTIONS },
          { name: 'ข้าวกะเพราทะเล', description: 'กุ้ง+ปลาหมึก ผัดกะเพรารสเด็ด', price: 85, options: FOOD_OPTIONS },
          { name: 'ข้าวผัดหมู', description: 'ข้าวผัดหอมกระทะ ใส่หมูชิ้นนุ่ม', price: 60, options: FOOD_OPTIONS.slice(0, 2) },
          { name: 'ข้าวผัดกุ้ง', description: 'ข้าวผัดกุ้งตัวโต โรยต้นหอม', price: 75, options: FOOD_OPTIONS.slice(0, 2) },
          { name: 'ข้าวไข่เจียวหมูสับ', description: 'ไข่เจียวฟูกรอบ หมูสับแน่นๆ', price: 55, options: FOOD_OPTIONS.slice(1, 2) },
          { name: 'ข้าวผัดพริกแกงหมู', description: 'ผัดพริกแกงใต้ถึงเครื่อง', price: 65, options: FOOD_OPTIONS },
        ],
      },
      {
        name: 'เมนูเส้น',
        items: [
          { name: 'ผัดซีอิ๊วหมู', description: 'เส้นใหญ่ผัดซีอิ๊ว หอมกลิ่นกระทะ', price: 60, options: FOOD_OPTIONS.slice(0, 2) },
          { name: 'ราดหน้าหมู', description: 'น้ำราดหน้าข้นๆ หมูหมักนุ่ม', price: 60, options: FOOD_OPTIONS.slice(0, 2) },
          { name: 'ผัดไทยกุ้งสด', description: 'ผัดไทยสูตรป้าแดง เปรี้ยวหวานกำลังดี', price: 75, options: FOOD_OPTIONS.slice(1, 2) },
          { name: 'สุกี้น้ำหมู', description: 'สุกี้น้ำซุปกลมกล่อม', price: 65, options: [] },
          { name: 'มาม่าผัดขี้เมาหมู', description: 'มาม่าผัดเผ็ดร้อนถึงใจ', price: 65, options: FOOD_OPTIONS.slice(0, 2) },
        ],
      },
      {
        name: 'กับข้าว & ต้ม',
        items: [
          { name: 'ต้มยำกุ้งน้ำข้น', description: 'ต้มยำกุ้งแม่น้ำ น้ำข้นแซ่บ', price: 120, options: [] },
          { name: 'ต้มจืดเต้าหู้หมูสับ', description: 'ซุปใสซดคล่องคอ เด็กทานได้', price: 70, options: [] },
          { name: 'ไข่เจียวทรงเครื่อง', description: 'ไข่เจียวใส่หมูสับ+ต้นหอม', price: 60, options: [] },
        ],
      },
      {
        name: 'เครื่องดื่ม',
        items: [
          { name: 'น้ำเปล่า', description: '', price: 10, options: [] },
          { name: 'น้ำอัดลมกระป๋อง', description: 'โค้ก / สไปรท์ / แฟนต้า', price: 20, options: [] },
          { name: 'ชาเย็น', description: 'ชาเย็นชงเข้ม หวานมัน', price: 30, options: [{ name: 'หวานน้อย', price_delta: 0 }] },
          { name: 'กาแฟเย็นโบราณ', description: 'กาแฟโบราณสูตรดั้งเดิม', price: 35, options: [{ name: 'หวานน้อย', price_delta: 0 }] },
        ],
      },
    ],
  },
  {
    slug: 'slow-morn-coffee',
    name: 'Slow Morn Coffee',
    phone: '082-345-6789',
    address: '45 ซอยนั่งชิล ถนนริมน้ำ ตำบลในเมือง อำเภอเมือง',
    promptpay_id: '0823456789',
    promptpay_name: 'Slow Morn Coffee',
    plan: 'basic',
    allow_dine_in: false,
    allow_takeaway: true,
    allow_delivery: false,
    categories: [
      {
        name: 'กาแฟร้อน',
        items: [
          { name: 'เอสเพรสโซ่ร้อน', description: 'ช็อตเข้มข้น เมล็ดอาราบิก้า 100%', price: 50, options: COFFEE_OPTIONS },
          { name: 'อเมริกาโน่ร้อน', description: 'กาแฟดำร้อน ดื่มง่าย', price: 55, options: COFFEE_OPTIONS },
          { name: 'ลาเต้ร้อน', description: 'เอสเพรสโซ่ + นมสดนุ่มๆ', price: 65, options: COFFEE_OPTIONS },
          { name: 'คาปูชิโน่ร้อน', description: 'ฟองนมหนานุ่ม โรยผงโกโก้', price: 65, options: COFFEE_OPTIONS },
          { name: 'มอคค่าร้อน', description: 'กาแฟ + ช็อกโกแลตเข้มข้น', price: 70, options: COFFEE_OPTIONS },
        ],
      },
      {
        name: 'กาแฟเย็น',
        items: [
          { name: 'อเมริกาโน่เย็น', description: 'กาแฟดำเย็น สดชื่น', price: 60, options: COFFEE_OPTIONS },
          { name: 'ลาเต้เย็น', description: 'นมสดเย็น + เอสเพรสโซ่ดับเบิ้ลช็อต', price: 70, options: COFFEE_OPTIONS },
          { name: 'เอสเย็นไทยสไตล์', description: 'กาแฟนมข้นหวานมันสไตล์ไทย', price: 70, options: COFFEE_OPTIONS },
          { name: 'มอคค่าเย็น', description: 'กาแฟช็อกโกแลตเย็น ท็อปวิปครีม', price: 75, options: COFFEE_OPTIONS },
          { name: 'กาแฟส้ม', description: 'เอสเพรสโซ่ + น้ำส้มสด', price: 75, options: [{ name: 'หวานน้อย', price_delta: 0 }] },
        ],
      },
      {
        name: 'ชา & เมนูอื่น',
        items: [
          { name: 'มัทฉะลาเต้', description: 'ชาเขียวมัทฉะเกรดพิธีการ + นมสด', price: 75, options: COFFEE_OPTIONS.slice(1) },
          { name: 'โกโก้เย็น', description: 'โกโก้เข้มข้น หวานกำลังดี', price: 65, options: [{ name: 'หวานน้อย', price_delta: 0 }] },
          { name: 'ชาไทยเย็น', description: 'ชาไทยหอมๆ หวานมัน', price: 55, options: [{ name: 'หวานน้อย', price_delta: 0 }] },
          { name: 'นมสดเย็น', description: 'นมสดพาสเจอร์ไรซ์เย็นๆ', price: 50, options: [] },
        ],
      },
      {
        name: 'เบเกอรี่',
        items: [
          { name: 'ครัวซองต์เนยสด', description: 'อบใหม่ทุกเช้า กรอบนอกนุ่มใน', price: 55, options: [{ name: 'อุ่นร้อน', price_delta: 0 }] },
          { name: 'ขนมปังปิ้งสังขยา', description: 'ปิ้งเตาถ่าน ทาสังขยาใบเตย', price: 40, options: [] },
          { name: 'เค้กช็อกโกแลต', description: 'เค้กช็อกหน้านิ่ม', price: 75, options: [] },
          { name: 'ซอฟต์คุกกี้', description: 'คุกกี้ช็อกชิพชิ้นโต', price: 35, options: [{ name: 'อุ่นร้อน', price_delta: 0 }] },
        ],
      },
    ],
  },
];

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const before = await client.query(
    'select (select count(*) from public.shops) as shops, (select count(*) from public.orders) as orders, (select count(*) from public.menu_items) as items'
  );
  console.log('BEFORE:', before.rows[0]);

  await client.query('BEGIN');
  try {
    // 1. ล้างข้อมูลทั้งหมด (orders/payments/users ของร้านจะถูกลบแบบ cascade, superadmin ที่ไม่มี shop_id จะเหลืออยู่)
    await client.query('TRUNCATE public.shops CASCADE');

    // 2. Seed 2 ร้าน
    for (const shop of SHOPS) {
      const s = await client.query(
        `insert into public.shops (slug, name, phone, address, promptpay_id, promptpay_name, plan, status, is_active, allow_dine_in, allow_takeaway, allow_delivery)
         values ($1,$2,$3,$4,$5,$6,$7,'active',true,$8,$9,$10) returning id`,
        [shop.slug, shop.name, shop.phone, shop.address, shop.promptpay_id, shop.promptpay_name, shop.plan, shop.allow_dine_in, shop.allow_takeaway, shop.allow_delivery]
      );
      const shopId = s.rows[0].id;
      let catOrder = 0;
      for (const cat of shop.categories) {
        const c = await client.query(
          'insert into public.categories (shop_id, name, sort_order, is_active) values ($1,$2,$3,true) returning id',
          [shopId, cat.name, catOrder++]
        );
        const catId = c.rows[0].id;
        let itemOrder = 0;
        for (const item of cat.items) {
          const m = await client.query(
            'insert into public.menu_items (shop_id, category_id, name, description, price, is_available, sort_order) values ($1,$2,$3,$4,$5,true,$6) returning id',
            [shopId, catId, item.name, item.description || null, item.price, itemOrder++]
          );
          const menuId = m.rows[0].id;
          let optOrder = 0;
          for (const opt of item.options || []) {
            await client.query(
              'insert into public.options (menu_item_id, name, price_delta, is_available, sort_order) values ($1,$2,$3,true,$4)',
              [menuId, opt.name, opt.price_delta, optOrder++]
            );
          }
        }
      }
      console.log(`seeded: ${shop.name} (${shop.slug})`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const after = await client.query(`
    select (select count(*) from public.shops) as shops,
           (select count(*) from public.categories) as categories,
           (select count(*) from public.menu_items) as items,
           (select count(*) from public.options) as options,
           (select count(*) from public.orders) as orders,
           (select count(*) from public.users) as users`);
  console.log('AFTER:', after.rows[0]);
  const list = await client.query('select slug, name, plan from public.shops order by slug');
  list.rows.forEach((r) => console.log(` - [${r.slug}] ${r.name} (plan: ${r.plan})`));

  await client.end();
  console.log('DONE');
}

main().catch((e) => {
  console.error('SEED FAIL:', e.message);
  process.exit(1);
});
