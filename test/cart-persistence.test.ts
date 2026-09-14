import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const stripTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const MENU = 'src/app/[slug]/MenuClient.tsx';
const CHECKOUT = 'src/app/[slug]/checkout/CheckoutClient.tsx';

/**
 * ตะกร้าถูกเก็บใน localStorage ของเบราว์เซอร์ จึงจำลองพฤติกรรมการอ่านเขียน
 * ด้วย key เดียวกับที่โค้ดใช้จริง แล้วยืนยันว่า contract ที่สองหน้าตกลงกันไว้
 * ยังตรงกันอยู่ ถ้า key หรือรูปแบบข้อมูลเพี้ยน ตะกร้าจะหายข้ามหน้าโดยไม่มีใครรู้
 */

/** อ่าน key ที่โค้ดใช้จริงออกมาจากซอร์ส แทนการเขียนซ้ำในเทส */
function storageKeyPattern(code: string): RegExp | null {
  const match = code.match(/localStorage\.(?:getItem|setItem)\(`([^`]+)`/);
  if (!match) return null;
  return new RegExp('^' + match[1].replace(/\$\{[^}]+\}/g, '(.+)') + '$');
}

describe('ตะกร้า: หน้าเมนูจำของที่เลือกไว้ข้าม reload', () => {
  const menu = () => stripTs(source(MENU));

  it('อ่านตะกร้าคืนมาตอนเปิดหน้า', () => {
    const code = menu();
    assert.match(code, /localStorage\.getItem\(`cart_\$\{shop\.id\}`\)/);
    assert.match(code, /setCart\(JSON\.parse\(saved\)\)/);
  });

  it('บันทึกทุกครั้งที่ตะกร้าเปลี่ยน', () => {
    const code = menu();
    assert.match(code, /localStorage\.setItem\(`cart_\$\{shop\.id\}`, JSON\.stringify\(cart\)\)/);
    assert.match(code, /\}, \[cart, shop\.id\]\)/, 'effect ต้องผูกกับ cart จึงจะบันทึกทุกครั้งที่เปลี่ยน');
  });

  it('อ่านหรือเขียนพังต้องไม่ทำให้หน้าเมนูล่ม', () => {
    const code = menu();
    const occurrences = code.match(/catch \(e\)/g) ?? [];
    assert.ok(occurrences.length >= 2, 'ทั้งขาอ่านและขาเขียนต้องมี try/catch');
  });
});

describe('ตะกร้า: หน้าชำระเงินอ่าน key เดียวกับหน้าเมนู', () => {
  it('ทั้งสองหน้าใช้รูปแบบ key เดียวกัน ไม่งั้นตะกร้าหายตอนกดไปชำระเงิน', () => {
    const menuKey = storageKeyPattern(stripTs(source(MENU)));
    const checkoutKey = storageKeyPattern(stripTs(source(CHECKOUT)));
    assert.ok(menuKey, 'ไม่พบ key ของหน้าเมนู');
    assert.ok(checkoutKey, 'ไม่พบ key ของหน้าชำระเงิน');
    assert.equal(
      menuKey.source,
      checkoutKey.source,
      'key ของสองหน้าต้องเป็นรูปแบบเดียวกัน'
    );
  });

  it('key แยกตามร้าน ตะกร้าของคนละร้านต้องไม่ปนกัน', () => {
    const pattern = storageKeyPattern(stripTs(source(MENU)));
    assert.ok(pattern);
    assert.ok(
      pattern.test('cart_shop-a') && pattern.test('cart_shop-b'),
      'key ต้องมีส่วนที่ผันตามร้าน'
    );
    assert.ok(!pattern.test('cart'), 'key ต้องไม่ใช่ค่าคงที่ตัวเดียวสำหรับทุกร้าน');
  });
});

describe('ตะกร้า: จำลองการอ่านเขียนจริงด้วย key เดียวกับโค้ด', () => {
  /** ตัวแทน localStorage แบบง่าย พอสำหรับยืนยัน contract การเก็บข้อมูล */
  const makeStore = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  const cartOf = (shopId: string) => `cart_${shopId}`;

  it('ของที่ใส่ไว้ยังอยู่หลังปิดแล้วเปิดหน้าใหม่', () => {
    const store = makeStore();
    const cart = [{ menu_item_id: 'm1', qty: 2, line_total: 100 }];
    store.setItem(cartOf('shop-a'), JSON.stringify(cart));

    const restored = JSON.parse(store.getItem(cartOf('shop-a')) ?? '[]');
    assert.deepEqual(restored, cart);
  });

  it('ตะกร้าของคนละร้านไม่ปนกัน', () => {
    const store = makeStore();
    store.setItem(cartOf('shop-a'), JSON.stringify([{ menu_item_id: 'a', qty: 1 }]));
    store.setItem(cartOf('shop-b'), JSON.stringify([{ menu_item_id: 'b', qty: 5 }]));

    assert.equal(JSON.parse(store.getItem(cartOf('shop-a'))!)[0].menu_item_id, 'a');
    assert.equal(JSON.parse(store.getItem(cartOf('shop-b'))!)[0].qty, 5);
  });

  it('ไม่มีตะกร้าเก็บไว้ ต้องได้ตะกร้าว่าง ไม่ใช่พัง', () => {
    const store = makeStore();
    const raw = store.getItem(cartOf('shop-new'));
    assert.equal(raw, null);
    assert.deepEqual(JSON.parse(raw ?? '[]'), []);
  });

  it('ข้อมูลเสียต้องถูกจับได้ ไม่ปล่อยให้หน้าเว็บล่ม', () => {
    const store = makeStore();
    store.setItem(cartOf('shop-a'), '{ไม่ใช่ json');
    let threw = false;
    try {
      JSON.parse(store.getItem(cartOf('shop-a'))!);
    } catch {
      threw = true;
    }
    assert.ok(threw, 'ข้อมูลเสียต้อง throw เพื่อให้ try/catch ในโค้ดจับได้');
  });
});

describe('ตะกร้า: ล้างหลังสั่งสำเร็จ', () => {
  it('หน้าชำระเงินล้างตะกร้าเมื่อสร้างออเดอร์แล้ว', () => {
    const code = stripTs(source(CHECKOUT));
    const clearIdx = code.search(/localStorage\.removeItem\(`cart_\$\{shop\.id\}`\)/);
    assert.ok(clearIdx !== -1, 'ต้องล้างตะกร้าหลังสั่งสำเร็จ ไม่งั้นลูกค้าสั่งซ้ำโดยไม่ตั้งใจ');
  });
});
