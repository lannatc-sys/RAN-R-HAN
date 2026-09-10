import type { DeliveryLocation, DeliveryTripItem, ParsedCommentOrder } from './types';

/**
 * สกัดเบอร์โทรศัพท์ภาษาไทย (08x, 09x, 06x หรือเบอร์บ้าน 053x) จากข้อความ
 */
export function extractThaiPhone(text: string): { phone: string; cleanText: string } {
  // รองรับรูปแบบ: 0812345678, 081-234-5678, 081 234 5678
  const phoneRegex = /(0[689]\d{1}[- ]?\d{3}[- ]?\d{4}|0\d{1,2}[- ]?\d{3}[- ]?\d{4})/;
  const match = text.match(phoneRegex);

  if (!match) {
    return { phone: '', cleanText: text };
  }

  const rawPhone = match[0];
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  const cleanText = text.replace(rawPhone, ' ').replace(/\s+/g, ' ').trim();

  return { phone: cleanPhone, cleanText };
}

/**
 * ค้นหาสถานที่จุดรับสินค้าที่ตรงกับข้อความ โดยเทียบกับ Master Data
 */
export function matchDeliveryLocation(
  text: string,
  availableLocations: DeliveryLocation[]
): { location: DeliveryLocation | null; cleanText: string } {
  let matchedLoc: DeliveryLocation | null = null;
  let cleanText = text;

  // เรียงลำดับชื่อสถานที่ยาวสุดก่อน เพื่อจับคำค้นที่เฉพาะเจาะจงที่สุด
  const sortedLocations = [...availableLocations].sort((a, b) => b.name.length - a.name.length);

  for (const loc of sortedLocations) {
    // แยกคำสำคัญ เช่น "หน้าโรงพยาบาลศรีสังวาลย์" -> ["โรงพยาบาลศรีสังวาลย์", "รพ.ศรีสังวาลย์", "ศรีสังวาลย์"]
    const keywords = [loc.name];
    if (loc.name.includes('โรงพยาบาล')) {
      keywords.push(loc.name.replace('โรงพยาบาล', 'รพ.'));
      keywords.push('รพ.ศรีสังวาลย์');
      keywords.push('ศรีสังวาลย์');
    }
    if (loc.name.includes('กาดเทศบาล')) {
      keywords.push('กาดเทศบาล');
      keywords.push('ตลาดเทศบาล');
    }
    if (loc.name.includes('หนองจองคำ')) {
      keywords.push('หนองจองคำ');
    }

    const foundKeyword = keywords.find(kw => text.includes(kw));
    if (foundKeyword) {
      matchedLoc = loc;
      cleanText = text.replace(foundKeyword, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  return { location: matchedLoc, cleanText };
}

/**
 * แกะข้อความคอมเมนต์ Facebook 1 บรรทัด ออกมาเป็นโครงสร้างข้อมูลออเดอร์
 */
export function parseFacebookComment(
  rawText: string,
  availableLocations: DeliveryLocation[]
): ParsedCommentOrder {
  const text = rawText.trim();

  // 1. สกัดเบอร์โทรศัพท์
  const { phone, cleanText: textAfterPhone } = extractThaiPhone(text);

  // 2. แมตช์สถานที่จัดส่ง
  const { location, cleanText: textAfterLoc } = matchDeliveryLocation(
    textAfterPhone,
    availableLocations
  );

  // 3. สกัดชื่อและรายการสินค้า
  // แยกคำด้วยช่องว่าง
  const tokens = textAfterLoc.split(' ').filter(Boolean);
  let recipientName = 'ลูกค้า';
  let itemsSummary = '';
  let locationNote: string | null = null;

  if (tokens.length > 0) {
    recipientName = tokens[0];
    itemsSummary = tokens.slice(1).join(' ').trim();
  }

  // หากมีคำว่า "ข้าง", "หน้า", "จุดสังเกต", "ซอย" ให้แยกเป็น note
  const noteKeywords = ['ข้าง', 'ซอย', 'หน้าตู้', 'ประตู', 'ชั้น', 'เบอร์'];
  for (const kw of noteKeywords) {
    const idx = itemsSummary.indexOf(kw);
    if (idx !== -1) {
      locationNote = itemsSummary.substring(idx).trim();
      itemsSummary = itemsSummary.substring(0, idx).trim();
      break;
    }
  }

  if (!itemsSummary && tokens.length > 0) {
    itemsSummary = tokens.join(' ');
  }

  return {
    recipient_name: recipientName,
    recipient_phone: phone,
    location_id: location?.id || null,
    location_name: location?.name || null,
    location_note: locationNote,
    items_summary: itemsSummary || text,
    total_amount: 0,
    raw_text: rawText,
  };
}

/**
 * แกะข้อความคอมเมนต์หลายบรรทัดพร้อมกัน (Bulk Parse)
 */
export function parseBulkComments(
  bulkText: string,
  availableLocations: DeliveryLocation[]
): ParsedCommentOrder[] {
  return bulkText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 3) // กรองบรรทัดสั้นหรือว่าง
    .map(line => parseFacebookComment(line, availableLocations));
}

export interface LocationTripGroup {
  locationId: string;
  locationName: string;
  lat: number;
  lng: number;
  items: DeliveryTripItem[];
  deliveredCount: number;
  pendingCount: number;
}

/**
 * รวมกลุ่มรายการส่งในเที่ยวตามจุดรับสินค้า (Location) เพื่อใช้พล็อตบนแผนที่ Leaflet
 */
export function groupTripItemsByLocation(items: DeliveryTripItem[]): LocationTripGroup[] {
  const groups = new Map<string, LocationTripGroup>();

  for (const item of items) {
    const locId = item.location_id || 'unknown';
    const locName = item.location?.name || 'จุดรับระบุพิเศษ / อื่นๆ';
    const lat = item.location?.lat || 19.3005;
    const lng = item.location?.lng || 97.9678;

    if (!groups.has(locId)) {
      groups.set(locId, {
        locationId: locId,
        locationName: locName,
        lat,
        lng,
        items: [],
        deliveredCount: 0,
        pendingCount: 0,
      });
    }

    const group = groups.get(locId)!;
    group.items.push(item);
    if (item.delivery_status === 'delivered') {
      group.deliveredCount++;
    } else {
      group.pendingCount++;
    }
  }

  return Array.from(groups.values());
}
