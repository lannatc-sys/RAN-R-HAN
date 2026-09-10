'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  createLocationSchema,
  createTripSchema,
  createTripItemSchema,
  createPreorderRoundSchema,
  createPreorderItemSchema,
  CreateLocationInput,
  CreateTripInput,
  CreateTripItemInput,
  CreatePreorderRoundInput,
  CreatePreorderItemInput,
} from '@/lib/validations/delivery';
import type {
  DeliveryLocation,
  DeliveryTrip,
  DeliveryTripItem,
  DeliveryTripStatus,
  PreorderRound,
  PreorderRoundStatus,
  PreorderItem,
} from '@/lib/types';
import { formatThaiError } from '@/lib/thai-errors';

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
    // ignore
  }
}

// =============================================================================
// 1. DELIVERY LOCATIONS (จุดรับสินค้า)
// =============================================================================

export async function getDeliveryLocationsAction(shopId?: string): Promise<{
  success: boolean;
  data?: DeliveryLocation[];
  error?: string;
}> {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };
    if (shopId && shopId !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const admin = createAdminClient();
    const effectiveShopId = shopId || authedShopId;
    let query = admin
      .from('delivery_locations')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (effectiveShopId) {
      query = query.or(`shop_id.eq.${effectiveShopId},shop_id.is.null`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: formatThaiError(error) };
    return { success: true, data: (data as DeliveryLocation[]) || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createDeliveryLocationAction(rawInput: CreateLocationInput) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const validated = createLocationSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    if (validated.data.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('delivery_locations')
      .insert({
        shop_id: validated.data.shop_id || null,
        name: validated.data.name,
        zone_name: validated.data.zone_name,
        lat: validated.data.lat,
        lng: validated.data.lng,
        sort_order: validated.data.sort_order,
        is_active: validated.data.is_active,
      })
      .select()
      .single();

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate('/admin/delivery/locations');
    safeRevalidate('/admin/delivery/trips');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateDeliveryLocationAction(
  id: string,
  rawInput: Partial<CreateLocationInput>
) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: location, error: locationErr } = await admin
      .from('delivery_locations')
      .select('shop_id')
      .eq('id', id)
      .single();

    if (locationErr || !location) {
      return { success: false, error: locationErr ? formatThaiError(locationErr) : 'ไม่พบข้อมูลจุดรับสินค้า' };
    }
    if (location.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { error } = await admin
      .from('delivery_locations')
      .update(rawInput)
      .eq('id', id);

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate('/admin/delivery/locations');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteDeliveryLocationAction(id: string) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: location, error: locationErr } = await admin
      .from('delivery_locations')
      .select('shop_id')
      .eq('id', id)
      .single();

    if (locationErr || !location) {
      return { success: false, error: locationErr ? formatThaiError(locationErr) : 'ไม่พบข้อมูลจุดรับสินค้า' };
    }
    if (location.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { error } = await admin.from('delivery_locations').delete().eq('id', id);
    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate('/admin/delivery/locations');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =============================================================================
// 2. DELIVERY TRIPS (เที่ยวส่งของ)
// =============================================================================

export async function getDeliveryTripsAction(shopId: string): Promise<{
  success: boolean;
  data?: DeliveryTrip[];
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
      .from('delivery_trips')
      .select(`
        *,
        delivery_trip_items (
          id,
          delivery_status
        )
      `)
      .eq('shop_id', shopId)
      .order('trip_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: formatThaiError(error) };

    const mappedTrips = (data || []).map((t: any) => {
      const items = t.delivery_trip_items || [];
      const deliveredCount = items.filter((i: any) => i.delivery_status === 'delivered').length;
      return {
        id: t.id,
        shop_id: t.shop_id,
        trip_name: t.trip_name,
        trip_date: t.trip_date,
        cutoff_at: t.cutoff_at,
        delivery_time_window: t.delivery_time_window,
        status: t.status,
        created_at: t.created_at,
        updated_at: t.updated_at,
        items_count: items.length,
        delivered_count: deliveredCount,
      };
    });

    return { success: true, data: mappedTrips };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDeliveryTripDetailAction(tripId: string): Promise<{
  success: boolean;
  trip?: DeliveryTrip;
  items?: DeliveryTripItem[];
  error?: string;
}> {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: trip, error: tripErr } = await admin
      .from('delivery_trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: 'ไม่พบข้อมูลเที่ยวส่งนี้' };
    }
    if (trip.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { data: items, error: itemsErr } = await admin
      .from('delivery_trip_items')
      .select(`
        *,
        location:delivery_locations (*)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      return { success: false, error: formatThaiError(itemsErr) };
    }

    return {
      success: true,
      trip: trip as DeliveryTrip,
      items: (items as DeliveryTripItem[]) || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createDeliveryTripAction(rawInput: CreateTripInput) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const validated = createTripSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    if (validated.data.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('delivery_trips')
      .insert({
        shop_id: validated.data.shop_id,
        trip_name: validated.data.trip_name,
        trip_date: validated.data.trip_date,
        cutoff_at: validated.data.cutoff_at || null,
        delivery_time_window: validated.data.delivery_time_window || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate('/admin/delivery/trips');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateTripStatusAction(tripId: string, status: DeliveryTripStatus) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: trip, error: tripErr } = await admin
      .from('delivery_trips')
      .select('shop_id')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: tripErr ? formatThaiError(tripErr) : 'ไม่พบข้อมูลเที่ยวส่งนี้' };
    }
    if (trip.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { error } = await admin
      .from('delivery_trips')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tripId);

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate(`/admin/delivery/trips/${tripId}`);
    safeRevalidate('/admin/delivery/trips');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addTripItemAction(rawInput: CreateTripItemInput) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const validated = createTripItemSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const admin = createAdminClient();
    const { data: trip, error: tripErr } = await admin
      .from('delivery_trips')
      .select('shop_id')
      .eq('id', validated.data.trip_id)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: tripErr ? formatThaiError(tripErr) : 'ไม่พบข้อมูลเที่ยวส่งนี้' };
    }
    if (trip.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { data, error } = await admin
      .from('delivery_trip_items')
      .insert({
        trip_id: validated.data.trip_id,
        location_id: validated.data.location_id || null,
        recipient_name: validated.data.recipient_name,
        recipient_phone: validated.data.recipient_phone,
        location_note: validated.data.location_note || null,
        items_summary: validated.data.items_summary,
        order_reference_id: validated.data.order_reference_id || null,
        delivery_status: 'pending',
      })
      .select(`
        *,
        location:delivery_locations (*)
      `)
      .single();

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate(`/admin/delivery/trips/${validated.data.trip_id}`);
    return { success: true, data: data as DeliveryTripItem };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleTripItemDeliveredAction(itemId: string, delivered: boolean) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: item, error: itemErr } = await admin
      .from('delivery_trip_items')
      .select('trip_id')
      .eq('id', itemId)
      .single();

    if (itemErr || !item) {
      return { success: false, error: itemErr ? formatThaiError(itemErr) : 'ไม่พบรายการส่งของ' };
    }

    const { data: trip, error: tripErr } = await admin
      .from('delivery_trips')
      .select('shop_id')
      .eq('id', item.trip_id)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: tripErr ? formatThaiError(tripErr) : 'ไม่พบข้อมูลเที่ยวส่งนี้' };
    }
    if (trip.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const newStatus = delivered ? 'delivered' : 'pending';
    const deliveredAt = delivered ? new Date().toISOString() : null;

    const { data, error } = await admin
      .from('delivery_trip_items')
      .update({
        delivery_status: newStatus,
        delivered_at: deliveredAt,
      })
      .eq('id', itemId)
      .select('trip_id')
      .single();

    if (error) return { success: false, error: formatThaiError(error) };

    if (data?.trip_id) {
      safeRevalidate(`/admin/delivery/trips/${data.trip_id}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteTripItemAction(itemId: string, tripId: string) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: trip, error: tripErr } = await admin
      .from('delivery_trips')
      .select('shop_id')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: tripErr ? formatThaiError(tripErr) : 'ไม่พบข้อมูลเที่ยวส่งนี้' };
    }
    if (trip.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { error } = await admin.from('delivery_trip_items').delete().eq('id', itemId);
    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate(`/admin/delivery/trips/${tripId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =============================================================================
// 3. PREORDER ROUNDS (รอบพรีออเดอร์)
// =============================================================================

export async function getPreorderRoundsAction(shopId: string): Promise<{
  success: boolean;
  data?: PreorderRound[];
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
      .from('preorder_rounds')
      .select(`
        *,
        preorder_items (
          id,
          total_amount
        )
      `)
      .eq('shop_id', shopId)
      .order('delivery_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: formatThaiError(error) };

    const mapped = (data || []).map((r: any) => {
      const items = r.preorder_items || [];
      const totalRev = items.reduce((sum: number, item: any) => sum + Number(item.total_amount || 0), 0);
      return {
        id: r.id,
        shop_id: r.shop_id,
        title: r.title,
        cutoff_at: r.cutoff_at,
        delivery_date: r.delivery_date,
        delivery_time_window: r.delivery_time_window,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        items_count: items.length,
        total_revenue: totalRev,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPreorderRoundDetailAction(roundId: string): Promise<{
  success: boolean;
  round?: PreorderRound;
  items?: PreorderItem[];
  error?: string;
}> {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: round, error: roundErr } = await admin
      .from('preorder_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (roundErr || !round) {
      return { success: false, error: 'ไม่พบข้อมูลรอบพรีออเดอร์นี้' };
    }
    if (round.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { data: items, error: itemsErr } = await admin
      .from('preorder_items')
      .select(`
        *,
        location:delivery_locations (*)
      `)
      .eq('round_id', roundId)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      return { success: false, error: formatThaiError(itemsErr) };
    }

    return {
      success: true,
      round: round as PreorderRound,
      items: (items as PreorderItem[]) || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createPreorderRoundAction(rawInput: CreatePreorderRoundInput) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const validated = createPreorderRoundSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    if (validated.data.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('preorder_rounds')
      .insert({
        shop_id: validated.data.shop_id,
        title: validated.data.title,
        cutoff_at: validated.data.cutoff_at,
        delivery_date: validated.data.delivery_date,
        delivery_time_window: validated.data.delivery_time_window || null,
        status: 'open',
      })
      .select()
      .single();

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate('/admin/delivery/preorder');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updatePreorderRoundStatusAction(roundId: string, status: PreorderRoundStatus) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: round, error: roundErr } = await admin
      .from('preorder_rounds')
      .select('shop_id')
      .eq('id', roundId)
      .single();

    if (roundErr || !round) {
      return { success: false, error: roundErr ? formatThaiError(roundErr) : 'ไม่พบข้อมูลรอบพรีออเดอร์นี้' };
    }
    if (round.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { error } = await admin
      .from('preorder_rounds')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', roundId);

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate(`/admin/delivery/preorder/${roundId}`);
    safeRevalidate('/admin/delivery/preorder');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addPreorderItemAction(rawInput: CreatePreorderItemInput) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const validated = createPreorderItemSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const admin = createAdminClient();
    const { data: round, error: roundErr } = await admin
      .from('preorder_rounds')
      .select('shop_id')
      .eq('id', validated.data.round_id)
      .single();

    if (roundErr || !round) {
      return { success: false, error: roundErr ? formatThaiError(roundErr) : 'ไม่พบข้อมูลรอบพรีออเดอร์นี้' };
    }
    if (round.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { data, error } = await admin
      .from('preorder_items')
      .insert({
        round_id: validated.data.round_id,
        location_id: validated.data.location_id || null,
        recipient_name: validated.data.recipient_name,
        recipient_phone: validated.data.recipient_phone,
        location_note: validated.data.location_note || null,
        items_summary: validated.data.items_summary,
        total_amount: validated.data.total_amount,
        payment_method: validated.data.payment_method,
        payment_status: 'pending',
        raw_input_text: validated.data.raw_input_text || null,
      })
      .select(`
        *,
        location:delivery_locations (*)
      `)
      .single();

    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate(`/admin/delivery/preorder/${validated.data.round_id}`);
    return { success: true, data: data as PreorderItem };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePreorderItemAction(itemId: string, roundId: string) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();
    const { data: round, error: roundErr } = await admin
      .from('preorder_rounds')
      .select('shop_id')
      .eq('id', roundId)
      .single();

    if (roundErr || !round) {
      return { success: false, error: roundErr ? formatThaiError(roundErr) : 'ไม่พบข้อมูลรอบพรีออเดอร์นี้' };
    }
    if (round.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const { error } = await admin.from('preorder_items').delete().eq('id', itemId);
    if (error) return { success: false, error: formatThaiError(error) };

    safeRevalidate(`/admin/delivery/preorder/${roundId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addBulkPreorderItemsAction(
  roundId: string,
  items: Array<{
    recipient_name: string;
    recipient_phone?: string;
    location_id?: string | null;
    location_note?: string | null;
    items_summary: string;
    total_amount?: number;
    payment_method?: 'promptpay' | 'cash';
    raw_input_text?: string | null;
  }>
) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    if (!items || items.length === 0) {
      return { success: false, error: 'ไม่มีรายการที่จะบันทึก' };
    }

    const admin = createAdminClient();

    const { data: round, error: roundErr } = await admin
      .from('preorder_rounds')
      .select('shop_id')
      .eq('id', roundId)
      .single();

    if (roundErr || !round) {
      return { success: false, error: roundErr ? formatThaiError(roundErr) : 'ไม่พบข้อมูลรอบพรีออเดอร์นี้' };
    }
    if (round.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    const rowsToInsert = items.map(item => ({
      round_id: roundId,
      recipient_name: item.recipient_name || 'ลูกค้า',
      recipient_phone: item.recipient_phone || '',
      location_id: item.location_id || null,
      location_note: item.location_note || null,
      items_summary: item.items_summary,
      total_amount: item.total_amount || 0,
      payment_method: item.payment_method || 'cash',
      payment_status: 'pending',
      raw_input_text: item.raw_input_text || null,
    }));

    const { data, error } = await admin
      .from('preorder_items')
      .insert(rowsToInsert)
      .select(`
        *,
        location:delivery_locations (*)
      `);

    if (error) return { success: false, error: formatThaiError(error) };

    // บันทึก Audit Log สำหรับการนำเข้าพรีออเดอร์ (WP-21)
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await admin.from('audit_logs').insert({
        action: 'import_facebook_comments',
        entity_type: 'preorder_items',
        entity_id: roundId,
        user_id: user?.id,
        details: {
          round_id: roundId,
          items_count: data?.length || 0,
        },
      });
    } catch (auditErr) {
      console.warn('[Audit Log Warning]:', auditErr);
    }

    safeRevalidate(`/admin/delivery/preorder/${roundId}`);
    return { success: true, count: data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


/**
 * แปลงรอบพรีออเดอร์เป็นเที่ยวส่งของโดยอัตโนมัติ (Convert Preorder Round -> Delivery Trip)
 */
export async function convertPreorderRoundToTripAction(roundId: string, customTripName?: string) {
  try {
    const { shopId: authedShopId, error: authError } = await getAuthedUserShopId();
    if (authError) return { success: false, error: authError };
    if (!authedShopId) return { success: false, error: 'ไม่พบร้านค้าของผู้ใช้นี้' };

    const admin = createAdminClient();

    // 1. ดึงข้อมูลรอบพรีออเดอร์
    const { data: round, error: roundErr } = await admin
      .from('preorder_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (roundErr || !round) {
      return { success: false, error: 'ไม่พบรอบพรีออเดอร์' };
    }
    if (round.shop_id !== authedShopId) {
      return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' };
    }

    // 2. ดึงรายการในรอบ
    const { data: items, error: itemsErr } = await admin
      .from('preorder_items')
      .select('*')
      .eq('round_id', roundId);

    if (itemsErr) {
      return { success: false, error: formatThaiError(itemsErr) };
    }

    if (!items || items.length === 0) {
      return { success: false, error: 'ไม่มีรายการสั่งจองในรอบพรีออเดอร์นี้' };
    }

    // 3. สร้าง Delivery Trip
    const tripName = customTripName || `เที่ยวส่ง: ${round.title}`;
    const { data: newTrip, error: tripErr } = await admin
      .from('delivery_trips')
      .insert({
        shop_id: round.shop_id,
        trip_name: tripName,
        trip_date: round.delivery_date,
        cutoff_at: round.cutoff_at,
        delivery_time_window: round.delivery_time_window,
        status: 'draft',
      })
      .select()
      .single();

    if (tripErr || !newTrip) {
      return { success: false, error: formatThaiError(tripErr) };
    }

    // 4. สร้าง Delivery Trip Items จาก Preorder Items
    const tripItemsToInsert = items.map(item => ({
      trip_id: newTrip.id,
      location_id: item.location_id,
      recipient_name: item.recipient_name,
      recipient_phone: item.recipient_phone,
      location_note: item.location_note,
      items_summary: item.items_summary,
      order_reference_id: item.id,
      delivery_status: 'pending',
    }));

    const { error: insertItemsErr } = await admin
      .from('delivery_trip_items')
      .insert(tripItemsToInsert);

    if (insertItemsErr) {
      return { success: false, error: formatThaiError(insertItemsErr) };
    }

    // 5. ปรับสถานะรอบพรีออเดอร์เป็น completed
    await admin
      .from('preorder_rounds')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', roundId);

    safeRevalidate('/admin/delivery/trips');
    safeRevalidate('/admin/delivery/preorder');
    safeRevalidate(`/admin/delivery/preorder/${roundId}`);

    return {
      success: true,
      tripId: newTrip.id,
      itemsCount: tripItemsToInsert.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
