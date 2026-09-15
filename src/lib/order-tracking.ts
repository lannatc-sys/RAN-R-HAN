/**
 * ตัวตัดสินว่าหน้าติดตามของลูกค้ายังต้องถามสถานะต่อหรือหยุดได้แล้ว
 *
 * แยกออกมาจาก component เพราะเงื่อนไขนี้ต่างกันตามชนิดออเดอร์ และเคยพลาดมาแล้ว
 * ครั้งหนึ่ง อยู่ในไฟล์นี้จึงเทสพฤติกรรมได้ตรง ๆ ไม่ต้องเดาจากการอ่านซอร์ส
 *
 * ที่มาของความต่าง: migration 20260914000011 ทำให้ออเดอร์แบบจัดส่งเดินต่อจาก
 * `served` ไปจบที่ `completed` เมื่อไรเดอร์ส่งของและอัปโหลด POD สำเร็จ
 * ส่วน takeaway และ dine-in จบที่ `served` เพราะไม่มีขั้นตอนหลังจากนั้น
 *
 * ถ้าถือ `served` เป็นขั้นสุดท้ายของออเดอร์จัดส่งด้วย หน้าลูกค้าจะหยุดถาม
 * ตั้งแต่อาหารเสร็จ แล้วไม่มีวันเห็นว่าของส่งถึงแล้ว
 */

/** สถานะที่ไม่มีทางเปลี่ยนต่อได้อีกไม่ว่าออเดอร์แบบไหน */
const TERMINAL_FOR_ALL = ['completed', 'cancelled'] as const;

/**
 * true = หยุดถามสถานะได้แล้ว
 *
 * `orderType` ที่ไม่ใช่ 'delivery' ทั้งหมด (รวมค่าที่หายไป) ถือว่าจบที่ `served`
 * ซึ่งเป็นพฤติกรรมเดิมของ takeaway และ dine-in
 */
export function isOrderTrackingFinal(
  status: string | null | undefined,
  orderType: string | null | undefined
): boolean {
  if (!status) return false;

  if ((TERMINAL_FOR_ALL as readonly string[]).includes(status)) return true;

  // ออเดอร์จัดส่งยังมีขั้นตอนต่อหลังอาหารเสร็จ จึงยังหยุดไม่ได้
  if (orderType === 'delivery') return false;

  return status === 'served';
}
