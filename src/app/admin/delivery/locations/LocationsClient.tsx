'use client';

import { useState } from 'react';
import { DeliveryLocation } from '@/lib/types';
import {
  createDeliveryLocationAction,
  updateDeliveryLocationAction,
  deleteDeliveryLocationAction,
} from '@/app/actions/delivery';
import { MapPin, Plus, Trash2, CheckCircle2, XCircle, Compass, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface LocationsClientProps {
  initialLocations: DeliveryLocation[];
  shopId: string;
}

export function LocationsClient({ initialLocations, shopId }: LocationsClientProps) {
  const [locations, setLocations] = useState<DeliveryLocation[]>(initialLocations);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New location form state
  const [name, setName] = useState('');
  const [zoneName, setZoneName] = useState('เขตเทศบาลเมืองแม่ฮ่องสอน');
  const [lat, setLat] = useState('19.3005');
  const [lng, setLng] = useState('97.9678');
  const [sortOrder, setSortOrder] = useState('0');

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createDeliveryLocationAction({
        shop_id: shopId,
        name: name.trim(),
        zone_name: zoneName.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        sort_order: parseInt(sortOrder) || 0,
        is_active: true,
      });

      if (!res.success) {
        setError(res.error || 'เกิดข้อผิดพลาดในการบันทึกสถานที่');
      } else if (res.data) {
        setLocations(prev => [...prev, res.data as DeliveryLocation]);
        setShowAddModal(false);
        setName('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (loc: DeliveryLocation) => {
    try {
      const updatedStatus = !loc.is_active;
      const res = await updateDeliveryLocationAction(loc.id, { is_active: updatedStatus });
      if (res.success) {
        setLocations(prev =>
          prev.map(l => (l.id === loc.id ? { ...l, is_active: updatedStatus } : l))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบจุดรับสินค้านี้?')) return;
    try {
      const res = await deleteDeliveryLocationAction(id);
      if (res.success) {
        setLocations(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
            <MapPin className="w-6 h-6 text-amber-600" />
            จุดรับสินค้าหลัก (Delivery Locations Master Data)
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            จุดรับสินค้าคงที่ในเขตเทศบาลเมืองแม่ฮ่องสอนสำหรับเลือกลงในเที่ยวส่งและรอบพรีออเดอร์
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          เพิ่มจุดรับใหม่
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Locations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map(loc => (
          <div
            key={loc.id}
            className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base leading-snug">
                  {loc.name}
                </h3>
                <span
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                    loc.is_active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                  )}
                >
                  {loc.is_active ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}
                </span>
              </div>

              <div className="text-xs text-stone-500 dark:text-stone-400 mb-3 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{loc.zone_name}</span>
              </div>

              <div className="text-[11px] font-mono text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-800/60 px-2.5 py-1.5 rounded-lg mb-4 flex items-center justify-between">
                <span>GPS: {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-600 hover:underline inline-flex items-center gap-1"
                >
                  ดูแผนที่ <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800/80 pt-3 text-xs">
              <button
                onClick={() => handleToggleActive(loc)}
                className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1"
              >
                {loc.is_active ? (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-stone-400" />
                    <span>ปิดจุดนี้</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>เปิดจุดนี้</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleDelete(loc.id)}
                className="text-rose-500 hover:text-rose-700 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              เพิ่มจุดรับสินค้าใหม่
            </h2>

            <form onSubmit={handleAddLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  ชื่อจุดรับสินค้า (เช่น หน้า รพ.ศรีสังวาลย์, หนองจองคำ) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="เช่น หน้าไปรษณีย์แม่ฮ่องสอน"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  โซน / เขต
                </label>
                <input
                  type="text"
                  value={zoneName}
                  onChange={e => setZoneName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    ละติจูด (Latitude) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    ลองจิจูด (Longitude) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
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
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึกจุดรับ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
