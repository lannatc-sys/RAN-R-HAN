'use client';

import { useEffect, useRef } from 'react';
import type {
  AreaKind,
  LngLat,
  PolygonDraft,
} from '@/components/service-area-map/types';
import { isClosedRing } from '@/components/service-area-map/types';
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
}

export default function ServiceAreaLeafletCanvas({
  draft,
  activeKind,
  onAddPoint,
  disabled = false,
}: ServiceAreaLeafletCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // Keeps the click handler reading fresh props without tearing the map down.
  const handlerRef = useRef<(lngLat: LngLat) => void>(() => {});
  handlerRef.current = (lngLat: LngLat) => {
    if (disabled || isClosedRing(draft.coordinates)) return;
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
      layerRef.current = L.layerGroup().addTo(map);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

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
  }, [draft, activeKind]);

  const closed = isClosedRing(draft.coordinates);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full min-h-[280px] sm:min-h-[420px] aspect-[4/3] sm:aspect-[16/10] rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 z-0"
        style={{ cursor: disabled || closed ? 'default' : 'crosshair' }}
        role="application"
        aria-label={`แผนที่สำหรับวาดพื้นที่${activeKind === 'customer' ? 'ลูกค้า' : 'ไรเดอร์'}`}
      />
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        {disabled
          ? 'โหมดอ่านอย่างเดียว'
          : closed
            ? 'วงแหวนปิดแล้ว กด "ล้าง" เพื่อเริ่มวาดใหม่'
            : 'คลิกบนแผนที่เพื่อวางจุด ต้องมีอย่างน้อย 3 จุดจึงจะปิดวงแหวนได้'}
      </p>
    </div>
  );
}
