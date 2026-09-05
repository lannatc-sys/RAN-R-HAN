import { z } from 'zod';

export const createOrderSchema = z.object({
  shop_id: z.string().uuid({ message: 'รหัสร้านค้าไม่ถูกต้อง' }),
  customer_phone: z
    .string()
    .min(9, { message: 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก' })
    .max(15, { message: 'เบอร์โทรศัพท์ยาวเกินไป' })
    .optional()
    .or(z.literal('')),
  pickup_at: z.string().optional().nullable(),
  note: z.string().max(300, { message: 'หมายเหตุยาวเกินไป (ไม่เกิน 300 ตัวอักษร)' }).optional(),
  source: z.enum(['customer', 'staff']).default('customer'),
  payment_method: z.enum(['promptpay', 'cash']),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid({ message: 'รหัสเมนูไม่ถูกต้อง' }),
        qty: z.number().int().min(1, { message: 'จำนวนต้องอย่างน้อย 1' }).max(99, { message: 'จำนวนไม่เกิน 99' }),
        option_ids: z.array(z.string().uuid()).default([]),
        note: z.string().max(150).optional(),
      })
    )
    .min(1, { message: 'กรุณาเลือกอาหารอย่างน้อย 1 รายการ' }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
