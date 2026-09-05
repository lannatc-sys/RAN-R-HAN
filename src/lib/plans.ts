import { OrderType, Shop } from './types';

export interface PlanEntitlements {
  canDineIn: boolean;
  canTakeaway: boolean;
  canDelivery: boolean;
  planName: string;
}

/**
 * ดึงสิทธิ์ของฟังก์ชันตามระดับแพ็กเกจ (Plan)
 * - FREE / LITE / BASIC: ทานที่ร้าน (❌) | รับที่ร้าน (✅) | จัดส่งเอง (❌)
 * - STANDARD: ทานที่ร้าน (✅) | รับที่ร้าน (✅) | จัดส่งเอง (❌)
 * - PRO / PREMIUM / ENTERPRISE: ทานที่ร้าน (✅) | รับที่ร้าน (✅) | จัดส่งเอง (✅)
 */
export function getPlanEntitlements(plan: string = 'basic'): PlanEntitlements {
  const p = (plan || 'basic').toLowerCase().trim();

  if (p === 'pro' || p === 'premium' || p === 'enterprise') {
    return {
      canDineIn: true,
      canTakeaway: true,
      canDelivery: true,
      planName: 'Pro / Premium',
    };
  }

  if (p === 'standard') {
    return {
      canDineIn: true,
      canTakeaway: true,
      canDelivery: false,
      planName: 'Standard',
    };
  }

  // Free / Lite / Basic
  return {
    canDineIn: false,
    canTakeaway: true,
    canDelivery: false,
    planName: 'Free / Lite',
  };
}

/**
 * คำนวณรายการช่องทางสั่งอาหารที่เปิดใช้งานจริงของร้านค้า
 * โดยเชื่อมโยงระหว่าง สิทธิ์ตาม Plan, การตั้งค่าของร้าน (allow_*), และ Superadmin Override (is_delivery_enabled)
 */
export function getActiveFulfillmentModes(shop: {
  plan?: string;
  allow_dine_in?: boolean;
  allow_takeaway?: boolean;
  allow_delivery?: boolean;
  is_delivery_enabled?: boolean;
}): OrderType[] {
  const entitlements = getPlanEntitlements(shop.plan || 'basic');
  const modes: OrderType[] = [];

  // 1. ทานที่ร้าน (Dine-in): ต้องได้สิทธิ์ตาม Plan และร้านเปิดไว้ (default: true)
  if (entitlements.canDineIn && shop.allow_dine_in !== false) {
    modes.push('dine_in');
  }

  // 2. รับที่ร้าน (Takeaway / Pick-up): ได้สิทธิ์ทุก Plan และร้านเปิดไว้ (default: true)
  if (entitlements.canTakeaway && shop.allow_takeaway !== false) {
    modes.push('takeaway');
  }

  // 3. จัดส่งเอง (Delivery): ได้สิทธิ์ถ้า Plan อนุญาต หรือ Superadmin เปิด overrides ผ่าน is_delivery_enabled
  const deliveryPermitted = entitlements.canDelivery || Boolean(shop.is_delivery_enabled);
  if (deliveryPermitted && (shop.allow_delivery === true || shop.is_delivery_enabled === true)) {
    modes.push('delivery');
  }

  // Fallback กรณีร้านไม่ได้เปิดอะไรเลย ให้เปิด Takeaway เป็นค่าเริ่มต้นเสมอ
  if (modes.length === 0) {
    modes.push('takeaway');
  }

  return modes;
}
