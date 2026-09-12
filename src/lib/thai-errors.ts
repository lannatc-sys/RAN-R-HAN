/**
 * แปลง Error Code จาก PostgreSQL / Database Function เป็นภาษาไทยที่ผู้ใช้เข้าใจได้
 * ต้องตรงตัวพิมพ์ใหญ่-เล็ก (Case-sensitive) ตามที่ระบุใน migration SQL
 */
export function formatThaiError(error: any): string {
  if (!error) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง';

  // ตรวจสอบ PostgreSQL Unique Violation (23505) เช่น สลิปซ้ำ
  if (error.code === '23505') {
    if (typeof error.message === 'string' && error.message.includes('payments_trans_ref_uq')) {
      return 'สลิปนี้ถูกใช้งานไปแล้ว ไม่สามารถใช้ซ้ำได้';
    }
    return 'ข้อมูลนี้มีอยู่ในระบบแล้ว ไม่สามารถทำรายการซ้ำได้';
  }

  const msg = typeof error === 'string' ? error : error.message || '';

  if (msg.includes('SHOP_NOT_FOUND')) {
    return 'ไม่พบร้านค้านี้ หรือร้านค้าปิดให้บริการชั่วคราว';
  }
  if (msg.includes('SHOP_CLOSED')) {
    return 'ร้านปิดรับออเดอร์ชั่วคราว กรุณาลองใหม่เมื่อร้านเปิดให้บริการ';
  }
  if (msg.includes('EMPTY_CART')) {
    return 'ไม่มีรายการอาหารในตะกร้า กรุณาเลือกเมนูก่อนสั่งซื้อ';
  }
  if (msg.includes('INVALID_SOURCE')) {
    return 'แหล่งที่มาของคำสั่งซื้อไม่ถูกต้อง';
  }
  if (msg.includes('INVALID_QTY')) {
    return 'จำนวนอาหารในแต่ละรายการต้องอยู่ระหว่าง 1 ถึง 99 จาน';
  }
  if (msg.includes('MENU_NOT_FOUND')) {
    return 'ไม่พบรายการอาหารที่ระบุในร้านนี้';
  }
  if (msg.includes('MENU_UNAVAILABLE') || msg.includes('MENU_NOT_AVAILABLE')) {
    return 'รายการอาหารบางอย่างหมดชั่วคราว กรุณาปรับเปลี่ยนรายการ';
  }
  if (msg.includes('ORDER_NOT_FOUND')) {
    return 'ไม่พบคำสั่งซื้อที่ระบุ';
  }
  if (msg.includes('ORDER_FINALIZED')) {
    return 'คำสั่งซื้อนี้เสร็จสิ้นหรือถูกยกเลิกไปแล้ว';
  }
  if (msg.includes('UNDERPAID')) {
    return 'ยอดเงินในสลิปไม่ครบตามยอดบิล กรุณาตรวจสอบยอดชำระ';
  }
  if (msg.includes('ORDER_LOCKED')) {
    return 'คำสั่งซื้อนี้กำลังถูกประมวลผลอยู่ กรุณารอสักครู่';
  }

  return msg || 'เกิดข้อผิดพลาดในการทำรายการ กรุณาลองใหม่อีกครั้ง';
}
