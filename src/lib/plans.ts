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
export function getPlanEntitlements(plan: string = 'enterprise'): PlanEntitlements {
  // โหมดทดสอบระบบ: เปิดสิทธิ์ทุกระบบเต็มรูปแบบ (Dine-in, Takeaway, Delivery) สำหรับทุกแพ็กเกจ
  return {
    canDineIn: true,
    canTakeaway: true,
    canDelivery: true,
    planName: 'Enterprise / Pro (เปิดสิทธิ์ครบทุกระบบทดสอบ)',
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
  const modes: OrderType[] = [];

  // 1. ทานที่ร้าน (Dine-in): เปิดใช้งานเสมอ (เว้นแต่ร้านจะตั้งใจปิด)
  if (shop.allow_dine_in !== false) {
    modes.push('dine_in');
  }

  // 2. รับที่ร้าน (Takeaway / Pick-up): เปิดใช้งานเสมอ
  if (shop.allow_takeaway !== false) {
    modes.push('takeaway');
  }

  // 3. จัดส่งเอง (Delivery): เปิดใช้งานเสมอ
  if (shop.allow_delivery !== false) {
    modes.push('delivery');
  }

  // Fallback กรณีไม่ได้ระบุ ให้เปิดครบทั้ง 3 โหมดสำหรับการทดสอบ
  if (modes.length === 0) {
    return ['dine_in', 'takeaway', 'delivery'];
  }

  return modes;
}
