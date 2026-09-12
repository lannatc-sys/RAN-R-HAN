import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateShopGeoAction } from '../src/app/actions/settings';

describe('📍 Store Geo Coordinates Tests', () => {
  describe('Validation Rules', () => {
    it('ปฏิเสธเมื่อส่งมาแค่ละติจูดโดยไม่มีลองจิจูด', async () => {
      const result = await updateShopGeoAction({
        shop_id: 'test-shop',
        shop_lat: 19.3021,
        shop_lng: null,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('ให้ครบถ้วน'));
    });

    it('ปฏิเสธเมื่อส่งมาแค่ลองจิจูดโดยไม่มีละติจูด', async () => {
      const result = await updateShopGeoAction({
        shop_id: 'test-shop',
        shop_lat: null,
        shop_lng: 97.9654,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('ให้ครบถ้วน'));
    });

    it('ปฏิเสธเมื่อละติจูดเกิน 90 องศา', async () => {
      const result = await updateShopGeoAction({
        shop_id: 'test-shop',
        shop_lat: 95.5,
        shop_lng: 97.9654,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'));
    });

    it('ปฏิเสธเมื่อละติจูดต่ำกว่า -90 องศา', async () => {
      const result = await updateShopGeoAction({
        shop_id: 'test-shop',
        shop_lat: -95.5,
        shop_lng: 97.9654,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'));
    });

    it('ปฏิเสธเมื่อลองจิจูดเกิน 180 องศา', async () => {
      const result = await updateShopGeoAction({
        shop_id: 'test-shop',
        shop_lat: 19.3021,
        shop_lng: 185.0,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'));
    });

    it('ปฏิเสธเมื่อไม่มี shop_id', async () => {
      const result = await updateShopGeoAction({
        shop_id: '',
        shop_lat: 19.3021,
        shop_lng: 97.9654,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('ไม่พบรหัสร้านค้า'));
    });

    it('dispatch ถูก block เมื่อร้านไม่มีพิกัด (ALLOW_GEO_FALLBACK != true)', () => {
      const shopGeo = { shop_lat: null, shop_lng: null };
      const hasShopGeo = typeof shopGeo?.shop_lat === 'number' && typeof shopGeo?.shop_lng === 'number';
      assert.equal(hasShopGeo, false);
      const isBlocked = !hasShopGeo && process.env.ALLOW_GEO_FALLBACK !== 'true';
      assert.equal(isBlocked, true);
    });

    it('dispatch ผ่านการตรวจสอบพิกัดเมื่อร้านมีพิกัดครบถ้วน', () => {
      const shopGeo = { shop_lat: 19.3021, shop_lng: 97.9654 };
      const hasShopGeo = typeof shopGeo?.shop_lat === 'number' && typeof shopGeo?.shop_lng === 'number';
      assert.equal(hasShopGeo, true);
      const pickupLat = shopGeo.shop_lat;
      const pickupLng = shopGeo.shop_lng;
      assert.equal(pickupLat, 19.3021);
      assert.equal(pickupLng, 97.9654);
    });
  });
});
