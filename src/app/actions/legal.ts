'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ConsentType,
  ConsentLog,
  AuditLog,
  DataSubjectRequest,
  DataSubjectRequestStatus,
} from '@/lib/types';
import {
  createDataSubjectRequestSchema,
  CreateDataSubjectRequestInput,
} from '@/lib/validations/legal';
import { revalidatePath } from 'next/cache';

async function getAuthedUserShopId(): Promise<{ shopId: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { shopId: null, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
  }
  const admin = createAdminClient();
  const { data: profile } = await admin.from('users').select('shop_id').eq('id', user.id).single();
  if (!profile?.shop_id) {
    return { shopId: null, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };
  }
  return { shopId: profile.shop_id, error: null };
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore outside HTTP request lifecycle
  }
}

/**
 * บันทึกหลักฐานการให้ความยินยอม (Consent Evidence) - WP-20
 */
export async function createConsentLogAction(data: {
  shop_id?: string | null;
  order_id?: string | null;
  customer_phone?: string | null;
  consent_type: ConsentType;
  policy_version?: string;
  ip_address?: string | null;
  user_agent?: string | null;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data: log, error } = await admin
      .from('consent_logs')
      .insert({
        shop_id: data.shop_id || null,
        order_id: data.order_id || null,
        customer_phone: data.customer_phone || null,
        consent_type: data.consent_type,
        policy_version: data.policy_version || '2026-09-10',
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Consent Log Error]:', error);
      return { success: false, error: error.message };
    }

    return { success: true, logId: log?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * บันทึกประวัติการทำงานสำคัญเพื่อความโปร่งใส (Audit Log) - WP-21
 */
export async function createAuditLogAction(data: {
  shop_id?: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
    }

    const admin = createAdminClient();

    // บังคับ shop_id ให้เป็นร้านของผู้ใช้ที่ยืนยันตัวตนแล้วเสมอ ห้ามเชื่อค่าที่ผู้เรียกส่งมา
    // (ป้องกันไม่ให้ผู้ใช้ร้าน A เขียน audit log สวมรอยว่าเป็นของร้าน B)
    const { data: profile } = await admin.from('users').select('shop_id').eq('id', user.id).single();
    if (!profile?.shop_id) {
      return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };
    }

    const { data: log, error } = await admin
      .from('audit_logs')
      .insert({
        shop_id: profile.shop_id,
        user_id: user.id,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id || null,
        details: data.details || null,
        ip_address: data.ip_address || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Audit Log Error]:', error);
      return { success: false, error: error.message };
    }

    return { success: true, logId: log?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * ส่งคำร้องขอใช้สิทธิด้านข้อมูลส่วนบุคคล (PDPA Data Subject Request) - WP-23
 */
export async function submitDataSubjectRequestAction(
  rawInput: CreateDataSubjectRequestInput
): Promise<{ success: boolean; requestId?: string; dueDate?: string; error?: string }> {
  try {
    const validated = createDataSubjectRequestSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const admin = createAdminClient();
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from('data_subject_requests')
      .insert({
        shop_id: validated.data.shop_id || null,
        requester_name: validated.data.requester_name,
        requester_phone: validated.data.requester_phone,
        requester_email: validated.data.requester_email || null,
        request_type: validated.data.request_type,
        details: validated.data.details || null,
        status: 'pending',
        due_date: dueDate,
      })
      .select('id, due_date')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, requestId: data?.id, dueDate: data?.due_date };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * ดึงรายการคำร้องขอใช้สิทธิ (สำหรับเจ้าของร้าน/แอดมิน)
 */
export async function getDataSubjectRequestsAction(shopId: string): Promise<{
  success: boolean;
  data?: DataSubjectRequest[];
  error?: string;
}> {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };
    if (shopId !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('data_subject_requests')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data as DataSubjectRequest[]) || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * อัปเดตสถานะการดำเนินการตามคำร้องขอใช้สิทธิ (PDPA DSR Status)
 */
export async function updateDataSubjectRequestStatusAction(
  requestId: string,
  status: DataSubjectRequestStatus,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: request, error: requestErr } = await admin
      .from('data_subject_requests')
      .select('shop_id')
      .eq('id', requestId)
      .single();

    if (requestErr || !request) {
      return { success: false, error: requestErr ? requestErr.message : 'ไม่พบคำร้องขอนี้' };
    }
    if (request.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const updateData: any = {
      status,
      admin_notes: adminNotes || null,
    };
    if (status === 'completed' || status === 'rejected') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await admin
      .from('data_subject_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };

    safeRevalidate('/admin/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
