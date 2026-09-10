const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const MENU_DIR = path.join(__dirname, '..', 'public', 'images', 'menu');
const SHOPS_DIR = path.join(__dirname, '..', 'public', 'images', 'shops');

if (!fs.existsSync(MENU_DIR)) fs.mkdirSync(MENU_DIR, { recursive: true });
if (!fs.existsSync(SHOPS_DIR)) fs.mkdirSync(SHOPS_DIR, { recursive: true });

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

async function processImage(source, destPath) {
  let buffer;
  if (source.startsWith('http://') || source.startsWith('https://')) {
    buffer = await downloadBuffer(source);
  } else {
    buffer = fs.readFileSync(source);
  }

  await sharp(buffer)
    .resize(600, 600, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 85 })
    .toFile(destPath);

  const stats = fs.statSync(destPath);
  console.log(`✓ Processed ${path.basename(destPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
}

const BRAIN_DIR = 'C:/Users/GAME/.gemini/antigravity/brain/606e89cc-52e4-4be3-a04b-4f3b0915afa0';

const TASKS = [
  // Shop Logos
  {
    source: path.join(BRAIN_DIR, 'logo_krua_pa_daeng_1788938425294.jpg'),
    dest: path.join(SHOPS_DIR, 'krua-pa-daeng.webp'),
  },
  {
    source: path.join(BRAIN_DIR, 'logo_slow_morn_1788938465552.jpg'),
    dest: path.join(SHOPS_DIR, 'slow-morn-coffee.webp'),
  },

  // Krua Pa Daeng Menu (19 items)
  {
    source: path.join(MENU_DIR, 'kraphao-moo-khai-dao.jpg'),
    dest: path.join(MENU_DIR, 'kaphrao-moo-sap.webp'),
  },
  {
    source: path.join(BRAIN_DIR, 'kaphrao_gai_1788938255010.jpg'),
    dest: path.join(MENU_DIR, 'kaphrao-gai.webp'),
  },
  {
    source: path.join(BRAIN_DIR, 'kaphrao_thale_1788938310688.jpg'),
    dest: path.join(MENU_DIR, 'kaphrao-thale.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-khao-phat-mu.jpg'),
    dest: path.join(MENU_DIR, 'khao-phat-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-khao-phat-kung.jpg'),
    dest: path.join(MENU_DIR, 'khao-phat-goong.webp'),
  },
  {
    source: path.join(BRAIN_DIR, 'khao_khai_jiao_mu_1788938333728.jpg'),
    dest: path.join(MENU_DIR, 'khao-khai-jiao-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-phrik-khing-rice.jpg'),
    dest: path.join(MENU_DIR, 'khao-phat-prik-gaeng-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-pad-see-ew.jpg'),
    dest: path.join(MENU_DIR, 'pad-see-ew-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-rad-na.jpg'),
    dest: path.join(MENU_DIR, 'rad-na-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-phat-thai.jpg'),
    dest: path.join(MENU_DIR, 'pad-thai-goong.webp'),
  },
  {
    source: path.join(BRAIN_DIR, 'suki_nam_moo_1788938384995.jpg'),
    dest: path.join(MENU_DIR, 'suki-nam-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-khi-mao.jpg'),
    dest: path.join(MENU_DIR, 'mama-pad-kee-mao-moo.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-tom-yam.jpg'),
    dest: path.join(MENU_DIR, 'tom-yum-goong.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-tom-chuet.jpg'),
    dest: path.join(MENU_DIR, 'tom-jued-taohu-moo.webp'),
  },
  {
    source: path.join(BRAIN_DIR, 'khai_jiao_song_krueng_1788938403642.jpg'),
    dest: path.join(MENU_DIR, 'khai-jiao-song-krueng.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'water.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'canned-soda.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-cha-yen.jpg'),
    dest: path.join(MENU_DIR, 'cha-yen.webp'),
  },
  {
    source: path.join(MENU_DIR, 'test-oliang.jpg'),
    dest: path.join(MENU_DIR, 'oliang.webp'),
  },

  // Slow Morn Coffee Menu (18 items)
  {
    source: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'hot-espresso.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'hot-americano.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'hot-latte.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'hot-cappuccino.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'hot-mocha.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'iced-americano.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'iced-latte.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'es-yen.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'iced-mocha.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'orange-coffee.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'matcha-latte.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'iced-cocoa.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'thai-tea-iced.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'iced-milk.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'croissant.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'kaya-toast.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'chocolate-cake.webp'),
  },
  {
    source: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop',
    dest: path.join(MENU_DIR, 'soft-cookie.webp'),
  },

  // Bonus Thai Dessert for seed.sql (Krua Khun Yai)
  {
    source: path.join(MENU_DIR, 'test-mango.jpg'),
    dest: path.join(MENU_DIR, 'mango-sticky-rice.webp'),
  },
];

async function main() {
  console.log(`Starting image processing for ${TASKS.length} images...`);
  let success = 0;
  let failed = 0;

  for (const task of TASKS) {
    try {
      await processImage(task.source, task.dest);
      success++;
    } catch (err) {
      console.error(`✗ Error processing ${task.dest}:`, err.message);
      failed++;
    }
  }

  console.log(`\nCompleted: ${success} succeeded, ${failed} failed.`);
}

main().catch(console.error);
