import { encryptApiKey, decryptApiKey } from '../src/lib/crypto';
import { formatThaiError } from '../src/lib/thai-errors';
import { createOrderSchema } from '../src/lib/validations/order';
import { generatePromptPayQR } from '../src/lib/promptpay';

async function runTests() {
  console.log('--- Starting Smoke Tests for RAN-R-HAN ---\n');

  // Test 1: Crypto AES-256-GCM
  console.log('1. Testing AES-256-GCM encryption & decryption...');
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const originalKey = 'slp_live_test_api_key_123456789';
  const encrypted = encryptApiKey(originalKey);
  const decrypted = decryptApiKey(encrypted);
  if (decrypted !== originalKey) {
    throw new Error(`Decrypted mismatch! Expected: ${originalKey}, Got: ${decrypted}`);
  }
  console.log('   [PASS] AES-256-GCM encryption and decryption verified.\n');

  // Test 2: Thai Error Formatter Case Sensitivity
  console.log('2. Testing Thai Error Formatter (Case-Sensitive & Code 23505)...');
  const errorOrderLocked = formatThaiError(new Error('ORDER_LOCKED: บิลถูกล็อก'));
  if (!errorOrderLocked.includes('กำลังถูกประมวลผลอยู่')) {
    throw new Error('Failed to match ORDER_LOCKED!');
  }

  const error23505 = formatThaiError({ code: '23505', message: 'duplicate key value violates unique constraint payments_trans_ref_uq' });
  if (!error23505.includes('สลิปนี้ถูกใช้งานไปแล้ว')) {
    throw new Error('Failed to match 23505 duplicate slip error!');
  }
  console.log('   [PASS] Case-sensitive error mapping and duplicate slip check verified.\n');

  // Test 3: Zod Order Validation
  console.log('3. Testing Zod Order Validation...');
  const validOrder = createOrderSchema.safeParse({
    shop_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    customer_phone: '0812345678',
    payment_method: 'promptpay',
    source: 'customer',
    items: [
      {
        menu_item_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380001',
        qty: 2,
        option_ids: [],
      },
    ],
  });
  if (!validOrder.success) {
    throw new Error(`Valid order failed schema: ${JSON.stringify(validOrder.error)}`);
  }

  const invalidOrder = createOrderSchema.safeParse({
    shop_id: 'not-a-uuid',
    items: [],
    payment_method: 'invalid',
  });
  if (invalidOrder.success) {
    throw new Error('Invalid order passed validation unexpectedly!');
  }
  console.log('   [PASS] Zod input schemas verified.\n');

  // Test 4: PromptPay QR Generator
  console.log('4. Testing PromptPay QR Generator...');
  const qrUrl = await generatePromptPayQR('0891234567', 150.0);
  if (!qrUrl.startsWith('data:image/png;base64,')) {
    throw new Error('PromptPay QR did not generate expected data URL format');
  }
  console.log('   [PASS] PromptPay dynamic QR generation verified.\n');

  console.log('ALL SMOKE TESTS PASSED! ✅');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
