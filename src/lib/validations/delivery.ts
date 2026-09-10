import { z } from 'zod';

export const createLocationSchema = z.object({
  shop_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'กรุณาระบุชื่อสถานที่'),
  zone_name: z.string().default('เขตเทศบาลเมืองแม่ฮ่องสอน'),
  lat: z.number().min(-90).max(90, 'พิกัดละติจูดไม่ถูกต้อง'),
  lng: z.number().min(-180).max(180, 'พิกัดลองจิจูดไม่ถูกต้อง'),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const createTripSchema = z.object({
  shop_id: z.string().uuid('รหัสร้านค้าไม่ถูกต้อง'),
  trip_name: z.string().min(1, 'กรุณาระบุชื่อเที่ยวส่ง'),
  trip_date: z.string().min(1, 'กรุณาระบุวันที่จัดส่ง'),
  cutoff_at: z.string().nullable().optional(),
  delivery_time_window: z.string().nullable().optional(),
});

export const createTripItemSchema = z.object({
  trip_id: z.string().uuid('รหัสเที่ยวส่งไม่ถูกต้อง'),
  location_id: z.string().uuid('รหัสสถานที่ส่งไม่ถูกต้อง').nullable().optional(),
  recipient_name: z.string().min(1, 'กรุณาระบุชื่อผู้รับ'),
  recipient_phone: z.string().min(9, 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก'),
  location_note: z.string().nullable().optional(),
  items_summary: z.string().min(1, 'กรุณาระบุรายการสินค้า'),
  order_reference_id: z.string().uuid().nullable().optional(),
});

export const createPreorderRoundSchema = z.object({
  shop_id: z.string().uuid('รหัสร้านค้าไม่ถูกต้อง'),
  title: z.string().min(1, 'กรุณาระบุชื่อรอบพรีออเดอร์'),
  cutoff_at: z.string().min(1, 'กรุณาระบุเวลาปิดรับออเดอร์'),
  delivery_date: z.string().min(1, 'กรุณาระบุวันจัดส่ง'),
  delivery_time_window: z.string().nullable().optional(),
});

export const createPreorderItemSchema = z.object({
  round_id: z.string().uuid('รหัสรอบพรีออเดอร์ไม่ถูกต้อง'),
  location_id: z.string().uuid('รหัสสถานที่ส่งไม่ถูกต้อง').nullable().optional(),
  recipient_name: z.string().min(1, 'กรุณาระบุชื่อผู้สั่ง/ผู้รับ'),
  recipient_phone: z.string().min(9, 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก'),
  location_note: z.string().nullable().optional(),
  items_summary: z.string().min(1, 'กรุณาระบุรายการสินค้า'),
  total_amount: z.number().min(0, 'ยอดเงินต้องไม่ติดลบ').default(0),
  payment_method: z.enum(['promptpay', 'cash']).default('cash'),
  raw_input_text: z.string().nullable().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type CreateTripItemInput = z.infer<typeof createTripItemSchema>;
export type CreatePreorderRoundInput = z.infer<typeof createPreorderRoundSchema>;
export type CreatePreorderItemInput = z.infer<typeof createPreorderItemSchema>;
