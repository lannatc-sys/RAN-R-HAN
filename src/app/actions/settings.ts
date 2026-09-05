'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { encryptApiKey } from '@/lib/crypto';
import { revalidatePath } from 'next/cache';

export async function updateShopSettingsAction(data: {
  shop_id: string;
  name: string;
  promptpay_id: string;
  promptpay_name: string;
  service_charge: number;
  vat_mode: 'none' | 'inclusive' | 'exclusive';
}) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('shops')
    .update({
      name: data.name,
      promptpay_id: data.promptpay_id || null,
      promptpay_name: data.promptpay_name || null,
      service_charge: data.service_charge,
      vat_mode: data.vat_mode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.shop_id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/settings');
  return { success: true };
}

/**
 * บันทึก API key ของผู้ให้บริการตรวจสลิป (เช่น SlipOK) แบบเข้ารหัส (Write-only)
 * ห้ามส่งค่า decrypted กลับไปยัง client เด็ดขาด
 */
export async function saveSlipCredentialsAction(data: {
  shop_id: string;
  provider: string;
  api_key: string;
}) {
  if (!data.api_key || data.api_key.trim().length === 0) {
    return { success: false, error: 'กรุณาระบุ API Key' };
  }

  try {
    // เข้ารหัสด้วย AES-256-GCM ฝั่ง server
    const encryptedBuffer = encryptApiKey(data.api_key.trim());
    const admin = createAdminClient();

    const { error } = await admin.from('shop_payment_credentials').upsert(
      {
        shop_id: data.shop_id,
        slip_check_provider: data.provider || 'slipok',
        api_key_encrypted: encryptedBuffer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id' }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to encrypt and save credentials' };
  }
}
