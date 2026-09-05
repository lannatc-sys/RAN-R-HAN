import { z } from 'zod';

export const createOrderSchema = z
  .object({
    shop_id: z.string().uuid({ message: 'รหัสร้านค้าไม่ถูกต้อง' }),
    type: z.enum(['dine_in', 'takeaway', 'delivery']).default('takeaway'),
    table_no: z.string().max(50, { message: 'เบอร์โต๊ะยาวเกินไป' }).optional().nullable(),
    customer_name: z.string().max(100, { message: 'ชื่อผู้สั่งยาวเกินไป' }).optional().nullable(),
    customer_phone: z
      .string()
      .max(15, { message: 'เบอร์โทรศัพท์ยาวเกินไป' })
      .optional()
      .or(z.literal('')),
    delivery_address: z
      .string()
      .max(500, { message: 'ที่อยู่จัดส่งยาวเกินไป (ไม่เกิน 500 ตัวอักษร)' })
      .optional()
      .nullable(),
    delivery_lat: z.number().optional().nullable(),
    delivery_lng: z.number().optional().nullable(),
    pickup_at: z.string().optional().nullable(),
    note: z.string().max(300, { message: 'หมายเหตุยาวเกินไป (ไม่เกิน 300 ตัวอักษร)' }).optional(),
    source: z.enum(['customer', 'staff']).default('customer'),
    payment_method: z.enum(['promptpay', 'cash']),
    items: z
      .array(
        z.object({
          menu_item_id: z.string().uuid({ message: 'รหัสเมนูไม่ถูกต้อง' }),
          qty: z
            .number()
            .int()
            .min(1, { message: 'จำนวนต้องอย่างน้อย 1' })
            .max(99, { message: 'จำนวนไม่เกิน 99' }),
          option_ids: z.array(z.string().uuid()).default([]),
          note: z.string().max(150).optional(),
        })
      )
      .min(1, { message: 'กรุณาเลือกอาหารอย่างน้อย 1 รายการ' }),
  })
  .refine(
    (data) => {
      if (data.type === 'delivery') {
        return Boolean(data.customer_name && data.customer_name.trim().length > 0);
      }
      return true;
    },
    {
      message: 'กรุณาระบุชื่อผู้สั่งสำหรับจัดส่ง',
      path: ['customer_name'],
    }
  )
  .refine(
    (data) => {
      if (data.type === 'delivery') {
        return Boolean(data.customer_phone && data.customer_phone.trim().length >= 9);
      }
      return true;
    },
    {
      message: 'กรุณาระบุเบอร์โทรศัพท์อย่างน้อย 9 หลักสำหรับจัดส่ง',
      path: ['customer_phone'],
    }
  )
  .refine(
    (data) => {
      if (data.type === 'delivery') {
        return Boolean(data.delivery_address && data.delivery_address.trim().length > 0);
      }
      return true;
    },
    {
      message: 'กรุณาระบุที่อยู่จัดส่ง',
      path: ['delivery_address'],
    }
  )
  .refine(
    (data) => {
      if (data.type === 'dine_in') {
        return Boolean(data.table_no && data.table_no.trim().length > 0);
      }
      return true;
    },
    {
      message: 'กรุณาระบุเลขโต๊ะสำหรับทานที่ร้าน',
      path: ['table_no'],
    }
  );

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderOutput = z.infer<typeof createOrderSchema>;
