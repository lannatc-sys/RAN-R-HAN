import { z } from 'zod';

export const createDataSubjectRequestSchema = z.object({
  shop_id: z.string().uuid('รหัสร้านค้าไม่ถูกต้อง').nullable().optional(),
  requester_name: z.string().min(2, 'กรุณาระบุชื่อ-นามสกุลของผู้ขอใช้สิทธิ'),
  requester_phone: z
    .string()
    .min(9, 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก')
    .max(12, 'เบอร์โทรศัพท์ต้องไม่เกิน 12 หลัก'),
  requester_email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').nullable().optional(),
  request_type: z.enum([
    'access',
    'copy',
    'correct',
    'delete',
    'suspend',
    'portability',
    'withdraw',
    'object',
  ]),
  details: z.string().max(2000, 'รายละเอียดต้องไม่เกิน 2,000 ตัวอักษร').nullable().optional(),
});

export type CreateDataSubjectRequestInput = z.infer<typeof createDataSubjectRequestSchema>;
