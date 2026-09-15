/**
 * ตัวตัดสินว่าออเดอร์ควรถูกส่งเข้า dispatch อัตโนมัติหรือไม่ เมื่อครัวเปลี่ยนสถานะ
 *
 * อยู่ในไฟล์นี้แทนที่จะอยู่ใน server action เพราะไฟล์ `'use server'` บังคับให้ทุก
 * export เป็น async function การแยกออกมาทำให้เทสพฤติกรรมได้ตรง ๆ โดยไม่ต้องแตะ
 * ฐานข้อมูล และไม่ต้องเดาจากการอ่าน regex ในซอร์ส
 *
 * ตัวไฟล์นี้ไม่ตัดสินใจเรื่อง dispatch เอง ไม่รู้จักไรเดอร์ ไม่แตะตาราง
 * หน้าที่เดียวคือ "ควรเรียก dispatchOrderAction ไหม" ตรรกะการจ่ายงานจริง
 * ยังอยู่ที่ `dispatchOrderAction` และ RPC `find_available_riders` เหมือนเดิม
 */

/** สถานะที่ครัวใช้บอกว่าอาหารเสร็จพร้อมส่ง ระบบนี้ไม่มีค่า 'ready' แยกต่างหาก */
export const KITCHEN_READY_STATUS = 'served';

/**
 * dispatch_status ที่แปลว่า "ยังไม่มีใครเริ่มจ่ายงานนี้"
 *
 * `dispatching` ไม่อยู่ในรายการโดยตั้งใจ เพราะหมายความว่ามีรอบจ่ายงานกำลังทำอยู่
 * การกดซ้ำจึงต้องไม่เริ่มรอบใหม่ทับ
 * `assigned` / `in_transit` ก็ไม่อยู่ ซึ่ง `dispatchOrderAction` กันไว้อีกชั้นอยู่แล้ว
 */
const DISPATCHABLE_STATES: ReadonlySet<string> = new Set(['pending', 'failed']);

export interface AutoDispatchCandidate {
  type: string | null;
  dispatch_status: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

/**
 * คืน true เฉพาะเมื่อการเปลี่ยนสถานะครั้งนี้ควรจุด dispatch อัตโนมัติ
 *
 * เงื่อนไขครบทุกข้อ:
 *  - ครัวเพิ่งกดว่าอาหารเสร็จ
 *  - เป็นออเดอร์แบบจัดส่ง
 *  - ยังไม่มีรอบจ่ายงานค้างหรือไรเดอร์รับไปแล้ว
 *  - มีพิกัดปลายทางครบ ไม่งั้น dispatchOrderAction ปฏิเสธอยู่ดี
 */
export function shouldAutoDispatch(
  newStatus: string,
  order: AutoDispatchCandidate | null | undefined
): boolean {
  if (newStatus !== KITCHEN_READY_STATUS) return false;
  if (!order) return false;
  if (order.type !== 'delivery') return false;

  // null คือออเดอร์ที่ยังไม่เคยเข้าเส้นทาง dispatch เลย ถือว่าจ่ายได้
  const state = order.dispatch_status ?? 'pending';
  if (!DISPATCHABLE_STATES.has(state)) return false;

  const hasDestination =
    typeof order.delivery_lat === 'number' &&
    Number.isFinite(order.delivery_lat) &&
    typeof order.delivery_lng === 'number' &&
    Number.isFinite(order.delivery_lng);

  return hasDestination;
}
