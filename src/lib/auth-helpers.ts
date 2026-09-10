export interface RegisterValidationResult {
  isValid: boolean;
  error?: string;
  cleanPhone?: string;
  cleanEmail?: string;
  fullName?: string;
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลที่ใช้ในการลงทะเบียนร้านค้า
 */
export function validateRegisterInput(input: {
  shop_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  password?: string;
}): RegisterValidationResult {
  const { shop_name, first_name, last_name, phone, email, password } = input;

  if (
    !shop_name?.trim() ||
    !first_name?.trim() ||
    !last_name?.trim() ||
    !phone?.trim() ||
    !email?.trim() ||
    !password
  ) {
    return { isValid: false, error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' };
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9 || cleanPhone.length > 10) {
    return { isValid: false, error: 'เบอร์โทรศัพท์ต้องมี 9-10 หลัก' };
  }

  return {
    isValid: true,
    cleanPhone,
    cleanEmail: email.trim().toLowerCase(),
    fullName: `${first_name.trim()} ${last_name.trim()}`,
  };
}

/**
 * ตรวจสอบว่าอีเมลนี้ตรงกับ Superadmin หรือไม่
 */
export function isSuperadminUser(email?: string | null): boolean {
  if (!email) return false;
  const superAdminEmail = process.env.SUPER_ADMIN_USER;
  if (!superAdminEmail) return false;
  return email.trim().toLowerCase() === superAdminEmail.trim().toLowerCase();
}

/**
 * ตรวจสอบว่าสิทธิ์ Support Access ยังคงมีผลอยู่หรือไม่ (ยังไม่หมดอายุ)
 */
export function isSupportAccessActive(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return false;
  return expiryTime > Date.now();
}
