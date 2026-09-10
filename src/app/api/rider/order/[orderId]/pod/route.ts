import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const VALID_POD_EVENT_TYPES = ['delivered', 'unreachable_drop', 'picked_up'] as const;
type PodEventType = typeof VALID_POD_EVENT_TYPES[number];

// ขนาดไฟล์สูงสุด 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * POST /api/rider/order/[orderId]/pod
 * ไรเดอร์อัปโหลดภาพ Proof of Delivery (POD)
 *
 * Form Data:
 *   file: File (image)
 *   event_type: 'delivered' | 'unreachable_drop' | 'picked_up'
 *   gps_lat?: string
 *   gps_lng?: string
 *   delivery_event_id?: string
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orderId } = await params;

    // 1. ตรวจ Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventType = formData.get('event_type') as PodEventType | null;
    const gpsLatStr = formData.get('gps_lat') as string | null;
    const gpsLngStr = formData.get('gps_lng') as string | null;

    // 3. Validate
    if (!file) {
      return NextResponse.json({ error: 'กรุณาแนบไฟล์ภาพ POD' }, { status: 400 });
    }

    if (!eventType || !VALID_POD_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `event_type ไม่ถูกต้อง (ค่าที่ใช้ได้: ${VALID_POD_EVENT_TYPES.join(', ')})` },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ภาพ JPG, PNG, WebP, HEIC เท่านั้น' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์ต้องไม่เกิน 10 MB' },
        { status: 400 }
      );
    }

    const gpsLat = gpsLatStr ? parseFloat(gpsLatStr) : null;
    const gpsLng = gpsLngStr ? parseFloat(gpsLngStr) : null;

    // 4. หา rider record
    const { data: rider, error: riderError } = await supabase
      .from('riders')
      .select('id, shop_id')
      .eq('auth_user_id', user.id)
      .single();

    if (riderError || !rider) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลไรเดอร์' }, { status: 404 });
    }

    // 5. ตรวจว่า order assigned ให้ไรเดอร์นี้
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, shop_id, assigned_rider_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'ไม่พบ Order' }, { status: 404 });
    }

    if (order.assigned_rider_id !== rider.id) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์อัปโหลด POD ของ Order นี้' },
        { status: 403 }
      );
    }

    // 6. อัปโหลดไฟล์ขึ้น Supabase Storage
    // Path format: pod/{shop_id}/{order_id}/{timestamp}_{event_type}.{ext}
    const serverReceivedAt = new Date();
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const timestamp = serverReceivedAt.getTime();
    const storagePath = `pod/${order.shop_id}/${orderId}/${timestamp}_${eventType}.${ext}`;

    const adminClient = createAdminClient();
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminClient.storage
      .from('pod-uploads')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[pod/upload] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'ไม่สามารถอัปโหลดภาพได้ กรุณาลองใหม่' },
        { status: 500 }
      );
    }

    // 7. บันทึก Metadata ใน pod_uploads (พร้อม POD Watermark §9.3)
    const { data: podRecord, error: insertError } = await adminClient
      .from('pod_uploads')
      .insert({
        order_id: orderId,
        rider_id: rider.id,
        shop_id: order.shop_id,
        // Always unclaimed here. The final event RPC locks and claims this row.
        delivery_event_id: null,
        storage_path: storagePath,
        event_type: eventType,
        // Server Timestamp — Source of Truth (ไม่ใช้นาฬิกามือถือ §9.3)
        server_received_at: serverReceivedAt.toISOString(),
        gps_lat: gpsLat,
        gps_lng: gpsLng,
      })
      .select('id')
      .single();

    if (insertError || !podRecord) {
      console.error('[pod/upload] Metadata insert error:', insertError);
      // ลบไฟล์ที่อัปโหลดไปแล้วถ้า metadata บันทึกไม่ได้
      await adminClient.storage.from('pod-uploads').remove([storagePath]);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกข้อมูล POD ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pod_id: podRecord.id,
      storage_path: storagePath,
      server_received_at: serverReceivedAt.toISOString(),
    });
  } catch (err) {
    console.error('[pod/upload] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
