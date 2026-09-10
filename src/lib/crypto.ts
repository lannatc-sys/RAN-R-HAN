import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag

function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not defined in environment variables');
  }
  
  // If provided as 64-char hex string (32 bytes)
  if (keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }

  // Otherwise hash it with SHA-256 to guarantee 32 bytes
  return crypto.createHash('sha256').update(keyHex).digest();
}

/**
 * เข้ารหัสข้อความด้วย AES-256-GCM คืนค่าเป็น Buffer พร้อม IV และ Auth Tag สำหรับเก็บใน bytea
 */
export function encryptApiKey(plainText: string): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // จัดโครงสร้าง: [IV (12 bytes)] + [Auth Tag (16 bytes)] + [Ciphertext]
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * ถอดรหัส Buffer จากฐานข้อมูล bytea
 * ห้าม log ผลลัพธ์ decrypted ออกมาเด็ดขาด
 */
export function decryptApiKey(encryptedBuffer: Buffer | Uint8Array | string): string {
  const key = getEncryptionKey();
  let buf: Buffer;

  if (typeof encryptedBuffer === 'string') {
    const trimmed = encryptedBuffer.trim();
    if (trimmed.startsWith('\\x')) {
      buf = Buffer.from(trimmed.slice(2), 'hex');
    } else if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        buf = Buffer.from(parsed.data || parsed);
      } catch {
        buf = Buffer.from(trimmed, 'hex');
      }
    } else {
      buf = Buffer.from(trimmed, 'hex');
    }
  } else {
    buf = Buffer.isBuffer(encryptedBuffer) ? encryptedBuffer : Buffer.from(encryptedBuffer);
    // If bytea from Supabase contains serialized JSON: '{"type":"Buffer","data":[...]}'
    if (buf.length > 20 && buf[0] === 123 /* '{' */) {
      try {
        const str = buf.toString('utf8');
        if (str.startsWith('{"type":"Buffer"') || str.startsWith('{"data"')) {
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed.data)) {
            buf = Buffer.from(parsed.data);
          }
        }
      } catch {}
    }
  }

  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Corrupt ciphertext: Buffer is too short');
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
