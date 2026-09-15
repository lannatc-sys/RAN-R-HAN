'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  AreaKind,
  LngLat,
  PolygonDraft,
} from '@/components/service-area-map/types';
import { isClosedRing } from '@/components/service-area-map/types';
import type { ShopAreaPin } from '@/app/actions/superadmin';
import 'leaflet/dist/leaflet.css';

/** Mae Hong Son municipality, used until a shop's own coordinates are wired in. */
const DEFAULT_CENTER: [number, number] = [19.302, 97.968];
const DEFAULT_ZOOM = 14;

const AREA_COLOR: Record<AreaKind, string> = {
  customer: '#d97706',
  rider: '#2563eb',
};

interface ServiceAreaLeafletCanvasProps {
  draft: PolygonDraft;
  activeKind: AreaKind;
  onAddPoint?: (kind: AreaKind, point: LngLat) => void;
  disabled?: boolean;
  /** Shops that have coordinates; drawn as pins with their current radius. */
  shops?: ShopAreaPin[];
  selectedShopId?: string | null;
  onSelectShop?: (shopId: string) => void;
  /** When true a click places the selected shop instead of a polygon vertex. */
  pinMode?: boolean;
  onSetShopLocation?: (lngLat: LngLat) => void;
}

export default function ServiceAreaLeafletCanvas({
  draft,
  activeKind,
  onAddPoint,
  disabled = false,
  shops = [],
  selectedShopId = null,
  onSelectShop,
  pinMode = false,
  onSetShopLocation,
}: ServiceAreaLeafletCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const shopLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const selectShopRef = useRef<(id: string) => void>(() => {});
  const [mapReady, setMapReady] = useState(false);
  selectShopRef.current = (id: string) => onSelectShop?.(id);

  // Keeps the click handler reading fresh props without tearing the map down.
  const handlerRef = useRef<(lngLat: LngLat) => void>(() => {});
  handlerRef.current = (lngLat: LngLat) => {
    if (disabled) return;
    if (pinMode) {
      onSetShopLocation?.(lngLat);
      return;
    }
    if (isClosedRing(draft.coordinates)) return;
    onAddPoint?.(activeKind, lngLat);
  };

  // Create the map once.
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    let cancelled = false;

    import('leaflet').then((mod) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const L = (mod as any).default || mod;
      leafletRef.current = L;

      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: any) => {
        // GeoJSON order: longitude first.
        handlerRef.current([
          Number(e.latlng.lng.toFixed(6)),
          Number(e.latlng.lat.toFixed(6)),
        ]);
      });

      mapRef.current = map;
      // Shops sit beneath the draft so a vertex is never hidden by a pin.
      shopLayerRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        shopLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Redraw the shop pins whenever the shop list or the selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = shopLayerRef.current;
    if (!L || !layer) return;

    layer.clearLayers();

    for (const shop of shops) {
      if (shop.shop_lat === null || shop.shop_lng === null) continue;
      const at: [number, number] = [shop.shop_lat, shop.shop_lng];
      const selected = shop.id === selectedShopId;

      if (selected) {
        mapRef.current?.setView(at, Math.max(mapRef.current.getZoom(), DEFAULT_ZOOM), {
          animate: false,
        });
      }

      // The radius a shop uses today, so it is visible what a polygon replaces.
      const radius =
        activeKind === 'customer' ? shop.service_radius_m : shop.rider_work_radius_m;
      if (radius && radius > 0) {
        L.circle(at, {
          radius,
          color: '#94a3b8',
          weight: 1,
          dashArray: '4 4',
          fillOpacity: selected ? 0.06 : 0.02,
          interactive: false,
        }).addTo(layer);
      }

      L.circleMarker(at, {
        radius: selected ? 9 : 7,
        color: selected ? '#0f172a' : '#64748b',
        fillColor: shop.service_area_enabled ? '#22c55e' : '#ffffff',
        fillOpacity: 1,
        weight: selected ? 3 : 2,
      })
        .bindTooltip(
          `${shop.name}${shop.service_area_enabled ? '' : ' (ยังไม่เปิดจำกัดพื้นที่)'}`,
          { direction: 'top' }
        )
        .on('click', (e: any) => {
          // Selecting a shop must not also drop a vertex.
          L.DomEvent.stopPropagation(e);
          selectShopRef.current(shop.id);
        })
        .addTo(layer);
    }
  }, [shops, selectedShopId, activeKind, mapReady]);

  // Redraw whenever the draft changes.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;

    layer.clearLayers();
    const color = AREA_COLOR[activeKind];
    // Leaflet takes [lat, lng]; the draft stores [lng, lat].
    const latLngs = draft.coordinates.map(([lng, lat]) => [lat, lng]);
    if (latLngs.length === 0) return;

    const closed = isClosedRing(draft.coordinates);
    if (closed) {
      L.polygon(latLngs, { color, weight: 2, fillOpacity: 0.2 }).addTo(layer);
    } else if (latLngs.length > 1) {
      L.polyline(latLngs, { color, weight: 2, dashArray: '6 6' }).addTo(layer);
    }

    latLngs.forEach((point: any, index: number) => {
      // A closed ring repeats its first vertex; drawing it twice is noise.
      if (closed && index === latLngs.length - 1) return;
      L.circleMarker(point, {
        radius: 5,
        color,
        fillColor: '#ffffff',
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(String(index + 1), { permanent: false })
        .addTo(layer);
    });
  }, [draft, activeKind, mapReady]);

  const closed = isClosedRing(draft.coordinates);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full min-h-[280px] sm:min-h-[420px] aspect-[4/3] sm:aspect-[16/10] rounded-xl overflow-hidden border border-slate-300 z-0"
        style={{ cursor: disabled || (!pinMode && closed) ? 'default' : 'crosshair' }}
        role="application"
        aria-label={`แผนที่สำหรับวาดพื้นที่${activeKind === 'customer' ? 'ลูกค้า' : 'ไรเดอร์'}`}
      />
      <p className="mt-2 text-[11px] text-slate-500">
        {disabled
          ? 'โหมดอ่านอย่างเดียว'
          : pinMode
            ? 'คลิกบนแผนที่เพื่อย้ายตำแหน่งร้านที่เลือก'
            : closed
              ? 'วงแหวนปิดแล้ว กด "ล้าง" เพื่อเริ่มวาดใหม่'
              : 'คลิกบนแผนที่เพื่อวางจุด ต้องมีอย่างน้อย 3 จุดจึงจะปิดวงแหวนได้'}
      </p>
    </div>
  );
}
