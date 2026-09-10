import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

/**
 * ทำความสะอาดรหัสพร้อมเพย์ ลบช่องว่างและขีดออกให้เหลือเฉพาะตัวเลข
 */
export function normalizePromptPayId(promptpayId: string): string {
  if (!promptpayId) return '';
  return promptpayId.replace(/[^0-9]/g, '').trim();
}

/**
 * สร้าง Data URL ของภาพ QR Code พร้อมเพย์ตามมาตรฐาน EMVCo แบบระบุยอดเงิน
 * รองรับทั้งเบอร์โทรศัพท์ (10 หลัก), เลขบัตรประชาชน (13 หลัก), และ e-Wallet ID (15 หลัก)
 */
export async function generatePromptPayQR(promptpayId: string, amount: number): Promise<string> {
  if (!promptpayId) {
    throw new Error('PROMPTPAY_ID_REQUIRED: ร้านค้ายังไม่ได้ตั้งค่าพร้อมเพย์');
  }

  // ล้างอักขระที่ไม่ใช่ตัวเลข (ขีด, ช่องว่าง)
  const cleanId = normalizePromptPayId(promptpayId);

  if (cleanId.length < 10) {
    throw new Error('INVALID_PROMPTPAY_ID: รหัสพร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก');
  }

  const payload = generatePayload(cleanId, { amount: Number(amount.toFixed(2)) });
  
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 360,
    color: {
      dark: '#002f6c', // น้ำเงินพร้อมเพย์
      light: '#ffffff',
    },
  });

  return qrDataUrl;
}
