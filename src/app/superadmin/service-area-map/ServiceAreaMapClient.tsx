'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin, MapPinOff, CircleCheck, CircleSlash, Crosshair, Save } from 'lucide-react';
import { ServiceAreaMapEditorShell } from '@/components/service-area-map';
import type { ShopAreaPin } from '@/app/actions/superadmin';
import {
  getShopAreaPolygonsAction,
  setShopLocationAction,
  setShopServiceAreaPolygonAction,
  setShopServiceAreaSettingsAction,
} from '@/app/actions/superadmin';
import {
  geoJsonToPolygonDraft,
  polygonDraftToGeoJson,
  type PolygonDraft,
  type ServiceAreaMapEditorState,
} from '@/components/service-area-map';

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
  // ต้อง memo ไม่งั้น array ได้ identity ใหม่ทุก render และ effect ที่มันอยู่ใน deps
  // จะวนเรียก server action ไม่จบ (setSeed -> render -> located ใหม่ -> effect -> โหลดอีก)
  const located = useMemo(
    () => shops.filter((s) => s.shop_lat !== null && s.shop_lng !== null),
    [shops]
  );
  const unlocated = useMemo(
    () => shops.filter((s) => s.shop_lat === null || s.shop_lng === null),
    [shops]
  );

  const [selectedShopId, setSelectedShopId] = useState<string | null>(
    shops[0]?.id ?? null
  );
  // เลือกจาก shops ทั้งหมด ไม่ใช่เฉพาะร้านที่ปักหมุดแล้ว ร้านใหม่ที่ยังไม่มีพิกัด
  // ต้องเลือกได้เพื่อจะปักหมุดครั้งแรก
  const selected = shops.find((s) => s.id === selectedShopId) ?? null;
  const selectedIsLocated = selected
    ? selected.shop_lat !== null && selected.shop_lng !== null
    : false;

  // พื้นที่ที่ร้านนี้บันทึกไว้ ใช้เป็นค่าตั้งต้นของ editor แทน fixture สาธิต
  //
  // แยกสามสถานะให้ชัด ถ้าปล่อยให้ seed เป็น null ตอนโหลดพังแล้วยัง mount editor
  // shell จะ default ไปใช้ DEMO_INITIAL_EDITOR_STATE ซึ่งเป็นรูปสาธิต
  // แล้วปุ่มบันทึกของจริงจะเขียนรูปสาธิตทับพื้นที่ร้านได้
  const [seed, setSeed] = useState<ServiceAreaMapEditorState | null>(null);
  const [seedState, setSeedState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  // ฟอร์มเปิด/ปิดพื้นที่ + รัศมี fallback
  // 20260914000002 ย้ายสิทธิ์ไป superadmin และฝั่งร้านถูกปิดปุ่มไปแล้ว
  // ถ้าไม่มีตรงนี้จะไม่เหลือใครเปิด service_area_enabled ได้เลยทั้งระบบ
  const [enabledDraft, setEnabledDraft] = useState(false);
  const [serviceRadiusDraft, setServiceRadiusDraft] = useState('');
  const [riderRadiusDraft, setRiderRadiusDraft] = useState('');
  const loadingSeed = seedState === 'loading';

  useEffect(() => {
    if (!selectedShopId) {
      setSeed(null);
      setSeedState('idle');
      return;
    }
    let alive = true;
    setSeedState('loading');
    void (async () => {
      const res = await getShopAreaPolygonsAction(selectedShopId);
      if (!alive) return;
      if (!res.success) {
        setSeed(null);
        setSeedState('error');
        return;
      }
      const shop = shops.find((x) => x.id === selectedShopId);
      const blank = (kind: 'customer' | 'rider'): PolygonDraft => ({
        id: `${selectedShopId}-${kind}`,
        kind,
        coordinates: [],
        status: 'empty',
        fallbackRadiusMeters:
          (kind === 'customer' ? shop?.service_radius_m : shop?.rider_work_radius_m) ?? 0,
        label: kind === 'customer' ? 'พื้นที่ลูกค้า' : 'พื้นที่ไรเดอร์',
      });
      setSeed({
        activeAreaKind: 'customer',
        customerDraft:
          geoJsonToPolygonDraft(res.customer, 'customer', blank('customer')) ??
          blank('customer'),
        riderDraft:
          geoJsonToPolygonDraft(res.rider, 'rider', blank('rider')) ?? blank('rider'),
      });
      setSeedState('ready');
    })();
    return () => {
      alive = false;
    };
  }, [selectedShopId, shops, reloadToken]);

  useEffect(() => {
    const shop = shops.find((x) => x.id === selectedShopId) ?? null;
    setEnabledDraft(Boolean(shop?.service_area_enabled));
    setServiceRadiusDraft(shop?.service_radius_m != null ? String(shop.service_radius_m) : '');
    setRiderRadiusDraft(shop?.rider_work_radius_m != null ? String(shop.rider_work_radius_m) : '');
  }, [selectedShopId, shops]);

  const handleSaveSettings = () => {
    if (!selectedShopId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await setShopServiceAreaSettingsAction({
        shopId: selectedShopId,
        enabled: enabledDraft,
        serviceRadiusM: Number(serviceRadiusDraft),
        riderWorkRadiusM: Number(riderRadiusDraft),
      });
      setMessage(
        res.success
          ? { ok: true, text: 'บันทึกการตั้งค่าพื้นที่เรียบร้อย' }
          : { ok: false, text: res.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ' }
      );
    });
  };

  // I2: สัญญาของฐานข้อมูลรับ null เพื่อลบ polygon แล้วกลับไปใช้รัศมี แต่ปุ่ม
  // "ล้างจุด" ใน toolbar ล้างแค่ state ในหน้าจอ ของที่บันทึกไว้แล้วจึงลบไม่ได้เลย
  const handleRemoveSavedPolygon = (kind: 'customer' | 'rider') => {
    if (!selectedShopId) return;
    const label = kind === 'customer' ? 'พื้นที่ลูกค้า' : 'พื้นที่ไรเดอร์';
    if (
      !window.confirm(
        `ลบ${label}ที่บันทึกไว้ของ ${selected?.name ?? ''} ใช่หรือไม่?
หลังลบแล้วร้านนี้จะกลับไปใช้รัศมีแทน`
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await setShopServiceAreaPolygonAction({
        shopId: selectedShopId,
        kind,
        geojson: null,
      });
      if (res.success) {
        setMessage({ ok: true, text: `ลบ${label}เรียบร้อย กลับไปใช้รัศมีแล้ว` });
        setReloadToken((n) => n + 1);
      } else {
        setMessage({ ok: false, text: res.error ?? 'ลบพื้นที่ไม่สำเร็จ' });
      }
    });
  };

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

        {shops.length === 0 ? (
          <p className="text-xs text-slate-600">ยังไม่มีร้านในระบบ</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/*
              เลือกได้ทุกร้านรวมร้านที่ยังไม่มีพิกัด ร้านเปิดใหม่ต้องเลือกได้
              ก่อนจึงจะปักหมุดครั้งแรกได้ ถ้ากรองเฉพาะร้านที่ปักหมุดแล้ว
              ร้านใหม่จะไม่มีทางเข้าสู่สถานะมีพิกัดเลย
            */}
            {shops.map((shop) => {
              const active = shop.id === selectedShopId;
              const isLocated = shop.shop_lat !== null && shop.shop_lng !== null;
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
                  {!isLocated ? (
                    <MapPinOff className="w-3.5 h-3.5 text-amber-600" />
                  ) : shop.service_area_enabled ? (
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

        {selected && (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={enabledDraft}
                  onChange={(e) => setEnabledDraft(e.target.checked)}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>เปิดการจำกัดพื้นที่ของ {selected.name}</span>
              </label>
              {!selected.service_area_enabled && (
                <span className="text-[11px] text-slate-500">
                  ยังปิดอยู่ พื้นที่ที่วาดจะยังไม่มีผลจนกว่าจะเปิด
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  รัศมี fallback ลูกค้า (เมตร)
                </label>
                <input
                  type="number"
                  min={1}
                  value={serviceRadiusDraft}
                  onChange={(e) => setServiceRadiusDraft(e.target.value)}
                  className="w-36 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  รัศมี fallback ไรเดอร์ (เมตร)
                </label>
                <input
                  type="number"
                  min={1}
                  value={riderRadiusDraft}
                  onChange={(e) => setRiderRadiusDraft(e.target.value)}
                  className="w-36 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={pending || !selectedIsLocated}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                บันทึกการตั้งค่า
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              รัศมีคือค่าที่ใช้เมื่อร้านยังไม่ได้วาด polygon ถ้าวาดแล้ว polygon จะชนะรัศมีเสมอ
              ต้องปักหมุดพิกัดร้านก่อนจึงจะเปิดการจำกัดพื้นที่ได้
            </p>
          </div>
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
            ร้านเหล่านี้ยังไม่มีพิกัดจึงกำหนดพื้นที่ให้ไม่ได้ กดชื่อร้านเพื่อเข้าโหมดปักหมุด
            แล้วคลิกตำแหน่งร้านบนแผนที่
          </p>
          <ul className="flex flex-wrap gap-2">
            {unlocated.map((shop) => (
              <li key={shop.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedShopId(shop.id);
                    setPinMode(true);
                    setMessage(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  ปักหมุด {shop.name}
                </button>
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
            disabled={pending || !selectedIsLocated}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึกพื้นที่ของ {selected.name}</span>
          </button>

          <button
            type="button"
            onClick={() => handleRemoveSavedPolygon('customer')}
            disabled={pending || !selectedIsLocated}
            className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            ลบพื้นที่ลูกค้าที่บันทึกไว้
          </button>

          <button
            type="button"
            onClick={() => handleRemoveSavedPolygon('rider')}
            disabled={pending || !selectedIsLocated}
            className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            ลบพื้นที่ไรเดอร์ที่บันทึกไว้
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

      {/*
        mount editor เฉพาะตอนโหลดพื้นที่ของร้านนั้นสำเร็จแล้วเท่านั้น
        ห้าม mount ตอน seed เป็น null เด็ดขาด เพราะ shell จะ default ไปใช้
        DEMO_INITIAL_EDITOR_STATE แล้วปุ่มบันทึกของจริงจะเขียนรูปสาธิตทับร้าน
      */}
      {loadingSeed && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
          กำลังโหลดพื้นที่ที่บันทึกไว้...
        </div>
      )}

      {seedState === 'error' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 space-y-3">
          <p className="text-sm font-bold text-rose-900">โหลดพื้นที่ที่บันทึกไว้ไม่สำเร็จ</p>
          <p className="text-xs text-rose-900/80 leading-relaxed">
            ยังไม่เปิดตัวแก้ไขให้ เพราะถ้าเปิดตอนนี้จะได้รูปตั้งต้นที่ไม่ใช่ของร้านนี้
            แล้วการกดบันทึกจะทับพื้นที่เดิมทิ้ง ลองใหม่อีกครั้ง
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            ลองโหลดใหม่
          </button>
        </div>
      )}

      {seedState === 'idle' && !selectedShopId && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
          เลือกร้านก่อนจึงจะกำหนดพื้นที่ได้
        </div>
      )}

      {seedState === 'ready' && !selectedIsLocated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="text-sm font-bold text-amber-900">
            {selected?.name} ยังไม่มีพิกัดร้าน
          </p>
          <p className="text-xs text-amber-900/80 leading-relaxed">
            คลิกตำแหน่งร้านบนแผนที่ด้านล่างเพื่อปักหมุดก่อน แล้วจึงวาดพื้นที่ได้
            ปุ่มบันทึกพื้นที่ยังกดไม่ได้จนกว่าจะมีพิกัด
          </p>
        </div>
      )}

      {seedState === 'ready' && seed && (
        <ServiceAreaMapEditorShell
          key={selectedShopId ?? 'none'}
          mode="live"
          initialState={seed}
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
      )}


    </div>
  );
}
