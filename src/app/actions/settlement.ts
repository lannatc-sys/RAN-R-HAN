'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * สร้างใบค่ารอบของวันหนึ่ง
 *
 * ตรรกะการคิดเงินทั้งหมดอยู่ใน RPC `create_daily_settlement_draft` ที่เดียว
 * ทั้งเส้นทาง cron และปุ่มในหน้าแอดมินเรียกตัวเดียวกัน ไม่มีสูตรซ้ำสองที่
 *
 * RPC ถูก revoke จาก authenticated และ grant ให้ service_role เท่านั้น
 * จึงต้องเรียกผ่าน admin client และตรวจสิทธิ์ที่ชั้นนี้ให้ครบก่อนเสมอ
 * ตัว RPC เองไม่ได้ตรวจว่าใครเป็นคนเรียกและเรียกให้ร้านไหน
 */
export async function createDailySettlementDraftAction(input: {
  shopId: string;
  settlementDate?: string;
}): Promise<{ success: boolean; settlementId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    // ต้องเป็นคนของร้านนั้นเท่านั้น ห้ามข้ามร้าน
    const { data: hasAccess, error: accessError } = await supabase.rpc('has_shop_access', {
      lookup_shop_id: input.shopId,
    });
    if (accessError) {
      console.error('createDailySettlementDraftAction access check failed:', accessError);
      return { success: false, error: 'ตรวจสอบสิทธิ์ร้านค้าไม่สำเร็จ' };
    }
    if (!hasAccess) {
      return { success: false, error: 'ไม่มีสิทธิ์ออกใบค่ารอบของร้านค้านี้' };
    }

    if (input.settlementDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.settlementDate)) {
      return { success: false, error: 'รูปแบบวันที่ไม่ถูกต้อง' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('create_daily_settlement_draft', {
      p_shop_id: input.shopId,
      ...(input.settlementDate ? { p_settlement_date: input.settlementDate } : {}),
    });

    if (error) throw error;

    revalidatePath('/admin/settlement');
    return { success: true, settlementId: (data as string) ?? undefined };
  } catch (err: unknown) {
    console.error('createDailySettlementDraftAction error:', err);
    return { success: false, error: 'ออกใบค่ารอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}
