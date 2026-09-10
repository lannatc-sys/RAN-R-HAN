'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  DeliveryTrip,
  DeliveryTripItem,
  DeliveryLocation,
  DeliveryTripStatus,
} from '@/lib/types';
import {
  groupTripItemsByLocation,
  LocationTripGroup,
} from '@/lib/delivery-parser';
import {
  updateTripStatusAction,
  toggleTripItemDeliveredAction,
  addTripItemAction,
  deleteTripItemAction,
} from '@/app/actions/delivery';
import {
  Truck,
  ArrowLeft,
  Calendar,
  Clock,
  Phone,
  Navigation,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  MapPin,
  CheckCheck,
} from 'lucide-react';
import clsx from 'clsx';

// Dynamic import Leaflet to prevent SSR window issues
const DeliveryLeafletMap = dynamic(
  () => import('@/components/admin/delivery/DeliveryLeafletMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] sm:h-[420px] rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 text-sm">
        กำลังโหลดแผนที่แม่ฮ่องสอน...
      </div>
    ),
  }
);

interface TripDetailClientProps {
  initialTrip: DeliveryTrip;
  initialItems: DeliveryTripItem[];
  availableLocations: DeliveryLocation[];
}

export function TripDetailClient({
  initialTrip,
  initialItems,
  availableLocations,
}: TripDetailClientProps) {
  const [trip, setTrip] = useState<DeliveryTrip>(initialTrip);
  const [items, setItems] = useState<DeliveryTripItem[]>(initialItems);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // New item form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [locationId, setLocationId] = useState<string>(
    availableLocations[0]?.id || ''
  );
  const [locationNote, setLocationNote] = useState('');
  const [itemsSummary, setItemsSummary] = useState('');

  // Group items by location for map visualization
  const locationGroups = useMemo(() => {
    return groupTripItemsByLocation(items);
  }, [items]);

  const totalRecipients = items.length;
  const deliveredCount = items.filter(i => i.delivery_status === 'delivered').length;
  const pendingCount = totalRecipients - deliveredCount;

  // Filter items if a location pin is selected
  const displayedItems = useMemo(() => {
    if (!selectedLocationId) return items;
    return items.filter(i => i.location_id === selectedLocationId);
  }, [items, selectedLocationId]);

  const handleStatusChange = async (newStatus: DeliveryTripStatus) => {
    try {
      const res = await updateTripStatusAction(trip.id, newStatus);
      if (res.success) {
        setTrip(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleDelivered = async (item: DeliveryTripItem) => {
    const nextStatus = item.delivery_status !== 'delivered';
    try {
      // Optimistic update
      setItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                delivery_status: nextStatus ? 'delivered' : 'pending',
                delivered_at: nextStatus ? new Date().toISOString() : null,
              }
            : i
        )
      );

      await toggleTripItemDeliveredAction(item.id, nextStatus);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !itemsSummary) return;

    setLoadingAction(true);
    try {
      const res = await addTripItemAction({
        trip_id: trip.id,
        location_id: locationId || null,
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        location_note: locationNote.trim() || null,
        items_summary: itemsSummary.trim(),
      });

      if (res.success && res.data) {
        setItems(prev => [...prev, res.data as DeliveryTripItem]);
        setShowAddModal(false);
        setRecipientName('');
        setRecipientPhone('');
        setLocationNote('');
        setItemsSummary('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('ยืนยันลบรายการส่งของนี้?')) return;
    try {
      setItems(prev => prev.filter(i => i.id !== itemId));
      await deleteTripItemAction(itemId, trip.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link
          href="/admin/delivery/trips"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับไปหน้ารวมเที่ยวส่ง
        </Link>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 hidden sm:inline">สถานะเที่ยวส่ง:</label>
          <select
            value={trip.status}
            onChange={e => handleStatusChange(e.target.value as DeliveryTripStatus)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-amber-500"
          >
            <option value="draft">ฉบับร่าง (Draft)</option>
            <option value="in_transit">🛵 กำลังออกส่ง (In Transit)</option>
            <option value="completed">✓ ส่งเสร็จสิ้น (Completed)</option>
            <option value="cancelled">ยกเลิก (Cancelled)</option>
          </select>
        </div>
      </div>

      {/* Trip Header Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              <Truck className="w-6 h-6 text-amber-600 shrink-0" />
              {trip.trip_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 dark:text-stone-400 mt-1.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                วันที่: {trip.trip_date}
              </span>
              {trip.delivery_time_window && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  รอบส่ง: {trip.delivery_time_window}
                </span>
              )}
            </div>
          </div>

          {/* Metric Badges */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-center">
              <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                {totalRecipients}
              </div>
              <div className="text-[10px] text-stone-400">ทั้งหมด (คน)</div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 text-center">
              <div className="text-base font-bold text-amber-600">
                {pendingCount}
              </div>
              <div className="text-[10px] text-amber-600">รอส่ง (คน)</div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 text-center">
              <div className="text-base font-bold text-emerald-600">
                {deliveredCount}
              </div>
              <div className="text-[10px] text-emerald-600">ส่งแล้ว (คน)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Recipients */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Leaflet Map */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600" />
              แผนที่จุดรับสินค้า ({locationGroups.length} จุด)
            </h2>
            {selectedLocationId && (
              <button
                onClick={() => setSelectedLocationId(null)}
                className="text-xs text-amber-600 font-semibold hover:underline"
              >
                ดูทั้งหมด ({items.length} รายการ)
              </button>
            )}
          </div>

          <DeliveryLeafletMap
            groups={locationGroups}
            selectedLocationId={selectedLocationId}
            onSelectLocation={locId => setSelectedLocationId(locId)}
          />

          <p className="text-[11px] text-stone-400">
            * ตัวเลขบนหมุดแสดงจำนวนผู้รับสินค้าในจุดนั้น | แตะหมุดเพื่อกรองรายชื่อ หรือกดเปิด Google Maps นำทาง
          </p>
        </div>

        {/* Right Column: Recipients Checklist */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-amber-600" />
              รายชื่อผู้รับสินค้า {selectedLocationId && '(กรองตามจุดรับ)'}
            </h2>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มผู้รับ
            </button>
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {displayedItems.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-stone-900 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
                ยังไม่มีผู้รับในรายการนี้ กดปุ่ม &quot;เพิ่มผู้รับ&quot; ด้านบนเพื่อเพิ่มข้อมูล
              </div>
            ) : (
              displayedItems.map(item => {
                const isDelivered = item.delivery_status === 'delivered';
                const loc = item.location;
                const navUrl = loc
                  ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
                  : null;

                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'p-4 rounded-2xl border transition-all',
                      isDelivered
                        ? 'bg-stone-50/80 dark:bg-stone-900/40 border-stone-200/60 dark:border-stone-800/60 opacity-80'
                        : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 shadow-xs'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleToggleDelivered(item)}
                          className="shrink-0 text-stone-400 hover:text-amber-600 transition-colors"
                          title={isDelivered ? 'คลิกเพื่อเปลี่ยนเป็นยังไม่ส่ง' : 'คลิกเพื่อส่งแล้ว'}
                        >
                          {isDelivered ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <h4
                            className={clsx(
                              'font-bold text-sm',
                              isDelivered
                                ? 'line-through text-stone-400 dark:text-stone-500'
                                : 'text-stone-900 dark:text-stone-100'
                            )}
                          >
                            {item.recipient_name}
                          </h4>
                          {loc && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-500 flex items-center gap-1 font-medium">
                              <MapPin className="w-3 h-3" />
                              {loc.name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons: Call & Navigate */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.recipient_phone && (
                          <a
                            href={`tel:${item.recipient_phone}`}
                            className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            title={`โทรหา ${item.recipient_phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {navUrl && (
                          <a
                            href={navUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 hover:bg-amber-100 transition-colors"
                            title="นำทาง Google Maps"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition-colors"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Order items and note */}
                    <div className="bg-stone-50 dark:bg-stone-800/50 p-2.5 rounded-xl text-xs text-stone-700 dark:text-stone-300 mt-2">
                      <div className="font-medium">{item.items_summary}</div>
                      {item.location_note && (
                        <div className="text-stone-400 dark:text-stone-500 text-[11px] mt-1">
                          📍 จุดสังเกต: {item.location_note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Recipient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              เพิ่มผู้รับในเที่ยวส่งนี้
            </h2>

            <form onSubmit={handleAddItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  ชื่อผู้รับ / ลูกค้า *
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="เช่น พี่วรรณา, หมอสมเกียรติ"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  เบอร์โทรศัพท์ (สำหรับกดโทรในแอป)
                </label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={e => setRecipientPhone(e.target.value)}
                  placeholder="0812345678"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  จุดรับสินค้า *
                </label>
                <select
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {availableLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.zone_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  รายการสินค้าที่สั่ง *
                </label>
                <input
                  type="text"
                  required
                  value={itemsSummary}
                  onChange={e => setItemsSummary(e.target.value)}
                  placeholder="เช่น ข้าวหมูทอด 2 กล่อง, ชาเย็น 1"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  จุดสังเกต / หมายเหตุ
                </label>
                <input
                  type="text"
                  value={locationNote}
                  onChange={e => setLocationNote(e.target.value)}
                  placeholder="เช่น ข้างตู้ ATM, โทรบอกก่อนถึง 5 นาที"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50"
                >
                  {loadingAction ? 'กำลังบันทึก...' : 'เพิ่มผู้รับ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
