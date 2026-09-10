import type { OrderStatus } from './types';

/**
 * ตรวจสอบรูปแบบ PIN ของหน้า KDS (ต้องเป็นตัวเลข 4 หลักเท่านั้น)
 */
export function isValidKdsPinFormat(pin: string): boolean {
  if (!pin) return false;
  return /^\d{4}$/.test(pin.trim());
}

/**
 * ตรวจสอบความถูกต้องของ PIN โดยเปรียบเทียบกับ shopPin (fallback เป็น '0000')
 */
export function verifyKdsPin(inputPin: string, shopPin?: string | null): boolean {
  const expectedPin = shopPin || '0000';
  return inputPin.trim() === expectedPin.trim();
}

export interface KitchenOrderItem {
  id: string;
  order_no: number;
  status: OrderStatus;
  created_at: string;
  [key: string]: any;
}

/**
 * กรองเฉพาะออเดอร์ที่ยังทำงานอยู่ในครัว (pending, confirmed, cooking)
 * และจัดเรียงตามลำดับเวลาเข้าก่อน-หลัง (FIFO: First In, First Out)
 */
export function filterActiveKitchenOrders<T extends KitchenOrderItem>(orders: T[]): T[] {
  const activeStatuses: OrderStatus[] = ['pending', 'confirmed', 'cooking'];
  
  return orders
    .filter(order => activeStatuses.includes(order.status))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export interface KdsStatusBadgeInfo {
  label: string;
  colorClass: string;
}

/**
 * คืนค่าข้อความภาษาไทยและสี Badge สำหรับสถานะออเดอร์ในหน้าจอ KDS
 */
export function getKdsStatusBadge(status: OrderStatus): KdsStatusBadgeInfo {
  switch (status) {
    case 'pending':
      return { label: 'รอยืนยัน/รอชำระ', colorClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    case 'confirmed':
      return { label: 'ยืนยันแล้ว', colorClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    case 'cooking':
      return { label: 'กำลังปรุง', colorClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
    case 'served':
      return { label: 'พร้อมรับที่ร้าน', colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    case 'completed':
      return { label: 'เสร็จสิ้น', colorClass: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
    case 'cancelled':
      return { label: 'ยกเลิก', colorClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
    default:
      return { label: status, colorClass: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
  }
}
