'use client';

import { useEffect, useRef, useState } from 'react';
import type { RiderLiveMonitorRow } from '@/lib/rider-live-monitor';
import { isRiderMonitorOnline } from '@/lib/rider-live-monitor';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [19.302, 97.968];

interface RiderLiveMapProps {
  rows: RiderLiveMonitorRow[];
  selectedRiderId: string | null;
  onSelectRider: (riderId: string) => void;
}

export default function RiderLiveMap({
  rows,
  selectedRiderId,
  onSelectRider,
}: RiderLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const onSelectRef = useRef(onSelectRider);
  const lastBoundsKeyRef = useRef('');
  const [mapReady, setMapReady] = useState(false);
  onSelectRef.current = onSelectRider;

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    void import('leaflet').then((module) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const L = (module as any).default || module;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(DEFAULT_CENTER, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!mapReady || !L || !map || !layer) return;

    layer.clearLayers();
    const locatedRows = rows.filter(
      (row) => row.lat !== null && row.lng !== null
    );

    for (const row of locatedRows) {
      const selected = row.rider_id === selectedRiderId;
      const online = isRiderMonitorOnline(row);
      const color = row.location_is_stale
        ? '#d97706'
        : row.inside_work_area === false
          ? '#e11d48'
          : online
            ? '#059669'
            : '#64748b';
      const marker = L.circleMarker([row.lat, row.lng], {
        radius: selected ? 10 : 7,
        color: selected ? '#0f172a' : color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: selected ? 3 : 2,
      });
      marker
        .bindTooltip(`${row.display_name} · ${row.shop_name}`, { direction: 'top' })
        .on('click', () => onSelectRef.current(row.rider_id))
        .addTo(layer);
    }

    const boundsKey = locatedRows
      .map((row) => row.rider_id)
      .sort()
      .join('|');
    if (locatedRows.length > 0 && boundsKey !== lastBoundsKeyRef.current) {
      const bounds = L.latLngBounds(
        locatedRows.map((row) => [row.lat, row.lng])
      );
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16, animate: false });
      lastBoundsKeyRef.current = boundsKey;
    }
  }, [mapReady, rows, selectedRiderId]);

  useEffect(() => {
    if (!mapReady || !selectedRiderId) return;
    const selected = rows.find((row) => row.rider_id === selectedRiderId);
    if (selected?.lat === null || selected?.lng === null || !selected) return;
    mapRef.current?.setView([selected.lat, selected.lng], 16, { animate: false });
  }, [mapReady, rows, selectedRiderId]);

  const locatedCount = rows.filter(
    (row) => row.lat !== null && row.lng !== null
  ).length;

  return (
    <figure className="space-y-2">
      <div
        ref={containerRef}
        className="h-[360px] w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 z-0 sm:h-[480px]"
        role="img"
        aria-label={`แผนที่ตำแหน่งไรเดอร์ ${locatedCount} คน รายละเอียดทั้งหมดอยู่ในรายการถัดจากแผนที่`}
      />
      <figcaption className="text-[11px] text-slate-500">
        แผนที่เป็นมุมมองประกอบ รายการไรเดอร์ด้านข้างมีข้อมูลเดียวกันและใช้งานด้วยคีย์บอร์ดได้
      </figcaption>
    </figure>
  );
}
