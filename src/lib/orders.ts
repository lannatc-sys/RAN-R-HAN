import type { OrderStatus, VatMode } from './types';

/**
 * กำหนดกฎการเปลี่ยนสถานะออเดอร์ที่ถูกต้องตามกระบวนการทำงานของร้าน (Order Lifecycle)
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cooking', 'cancelled'],
  cooking: ['served'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * ตรวจสอบว่าสามารถเปลี่ยนสถานะออเดอร์จาก currentStatus ไปยัง nextStatus ได้หรือไม่
 */
export function isValidOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(nextStatus);
}

export interface OrderFinancialParams {
  subtotal: number;
  serviceChargePercent: number;
  vatMode: VatMode;
}

export interface OrderFinancialsResult {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  total: number;
}

/**
 * คำนวณยอดเงินรวม ค่าบริการ (Service Charge) และภาษีมูลค่าเพิ่ม (VAT) ตาม VatMode
 */
export function calculateOrderFinancials({
  subtotal,
  serviceChargePercent,
  vatMode,
}: OrderFinancialParams): OrderFinancialsResult {
  const scAmount = serviceChargePercent > 0 ? (subtotal * serviceChargePercent) / 100 : 0;
  const baseBeforeVat = subtotal + scAmount;

  let vatAmount = 0;
  let total = baseBeforeVat;

  if (vatMode === 'exclusive') {
    vatAmount = (baseBeforeVat * 7) / 100;
    total = baseBeforeVat + vatAmount;
  } else if (vatMode === 'inclusive') {
    // ภาษีรวมในราคาแล้ว 7/107
    vatAmount = (baseBeforeVat * 7) / 107;
    total = baseBeforeVat;
  }

  // ปัดเศษทศนิยม 2 ตำแหน่ง
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    serviceCharge: Math.round(scAmount * 100) / 100,
    vat: Math.round(vatAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
