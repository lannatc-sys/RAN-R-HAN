'use client';

import { useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin, MapPinOff, CircleCheck, CircleSlash, Crosshair, Save } from 'lucide-react';
import { ServiceAreaMapEditorShell } from '@/components/service-area-map';
import type { ShopAreaPin } from '@/app/actions/superadmin';
import {
  setShopLocationAction,
  setShopServiceAreaPolygonAction,
} from '@/app/actions/superadmin';
import { polygonDraftToGeoJson, type PolygonDraft } from '@/components/service-area-map';

// Leaflet touches window on import, so it must stay out of the server render.
const ServiceAreaLeafletCanvas = dynamic(
  () => import('@/components/superadmin/ServiceAreaLeafletCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[280px] sm:min-h-[420px] aspect-[4/3] sm:aspect-[16/10] rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 text-sm">
        กำลังโหลดแผนที่แม่ฮ่องสอน...
      </div>
    ),
  }
);

export function ServiceAreaMapClient({ shops }: { shops: ShopAreaPin[] }) {
  const located = shops.filter((s) => s.shop_lat !== null && s.shop_lng !== null);
  const unlocated = shops.filter((s) => s.shop_lat === null || s.shop_lng === null);

  const [selectedShopId, setSelectedShopId] = useState<string | null>(
    located[0]?.id ?? null
  );
  const selected = located.find((s) => s.id === selectedShopId) ?? null;

  const [pinMode, setPinMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // The shell owns the draft. The save button only needs to read whatever it is
  // holding at click time, so a ref avoids a second render per vertex.
  const draftRef = useRef<PolygonDraft | null>(null);

  const handleSetLocation = (lngLat: [number, number]) => {
    if (!selectedShopId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await setShopLocationAction({
        shopId: selectedShopId,
        lng: lngLat[0],
        lat: lngLat[1],
      });
      setMessage(
        res.success
          ? { ok: true, text: 'ปักหมุดร้านเรียบร้อย' }
          : { ok: false, text: res.error ?? 'ปักหมุดไม่สำเร็จ' }
      );
      if (res.success) setPinMode(false);
    });
  };

  const handleSavePolygon = () => {
    const draft = draftRef.current;
    if (!selectedShopId || !draft) return;
    const geojson = polygonDraftToGeoJson(draft);
    if (!geojson) {
      setMessage({ ok: false, text: 'ต้องปิดวงแหวนก่อนจึงจะบันทึกได้' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await setShopServiceAreaPolygonAction({
        shopId: selectedShopId,
        kind: draft.kind,
        geojson,
      });
      setMessage(
        res.success
          ? { ok: true, text: 'บันทึกพื้นที่เรียบร้อย' }
          : { ok: false, text: res.error ?? 'บันทึกไม่สำเร็จ' }
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Shop picker — which shop a drawn area belongs to */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <MapPin className="w-4 h-4 text-amber-600" />
          <span>เลือกร้านที่จะกำหนดพื้นที่</span>
          <span className="text-xs font-normal text-slate-500">
            ({located.length} ร้านปักหมุดแล้ว)
          </span>
        </div>

        {located.length === 0 ? (
          <p className="text-xs text-slate-600">
            ยังไม่มีร้านใดปักหมุดพิกัดไว้ จึงยังกำหนดพื้นที่ให้ร้านไหนไม่ได้
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {located.map((shop) => {
              const active = shop.id === selectedShopId;
              return (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setSelectedShopId(shop.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-amber-50 border-amber-400 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {shop.service_area_enabled ? (
                    <CircleCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <CircleSlash className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{shop.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {selected && !selected.service_area_enabled && (
          <p className="text-xs text-slate-600">
            ร้านนี้ยังไม่ได้เปิดการจำกัดพื้นที่ พื้นที่ที่วาดจะยังไม่มีผลจนกว่าจะเปิดใช้งาน
          </p>
        )}
      </div>

      {/* Shops that cannot be drawn for yet */}
      {unlocated.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <MapPinOff className="w-4 h-4" />
            <span>ยังไม่ได้ปักหมุด {unlocated.length} ร้าน</span>
          </div>
          <p className="text-xs text-amber-900/80">
            ร้านเหล่านี้ยังไม่มีพิกัดจึงกำหนดพื้นที่ให้ไม่ได้ ต้องตั้งพิกัดร้านก่อน
          </p>
          <ul className="flex flex-wrap gap-2">
            {unlocated.map((shop) => (
              <li
                key={shop.id}
                className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs text-slate-700"
              >
                {shop.name}
              </li>
            ))}
          </ul>
          <Link
            href="/superadmin/stores"
            className="inline-block text-xs font-semibold text-amber-900 underline underline-offset-2"
          >
            ไปหน้าจัดการร้านค้า
          </Link>
        </div>
      )}

      {selected && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPinMode((v) => !v)}
            disabled={pending}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
              pinMode
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{pinMode ? 'กำลังปักหมุด — คลิกบนแผนที่' : 'ย้ายตำแหน่งร้าน'}</span>
          </button>

          <button
            type="button"
            onClick={handleSavePolygon}
            disabled={pending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึกพื้นที่ของ {selected.name}</span>
          </button>

          {message && (
            <span
              className={`text-xs font-semibold ${
                message.ok ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
      )}

      <ServiceAreaMapEditorShell
        renderCanvas={(props) => {
          draftRef.current = props.draft;
          return (
            <ServiceAreaLeafletCanvas
              {...props}
              shops={located}
              selectedShopId={selectedShopId}
              onSelectShop={setSelectedShopId}
              pinMode={pinMode}
              onSetShopLocation={handleSetLocation}
            />
          );
        }}
      />
    </div>
  );
}
