'use client';

import React from 'react';
import { MousePointerClick, Zap } from 'lucide-react';
import { AreaKind, LngLat, PolygonDraft, isClosedRing } from './types';

interface MapCanvasPlaceholderProps {
  draft: PolygonDraft;
  activeKind: AreaKind;
  onAddPoint?: (kind: AreaKind, point: LngLat) => void;
  className?: string;
  disabled?: boolean;
}

export const MapCanvasPlaceholder: React.FC<MapCanvasPlaceholderProps> = ({
  draft,
  activeKind,
  onAddPoint,
  className = '',
  disabled = false,
}) => {
  const closed = isClosedRing(draft.coordinates);
  const isCustomer = activeKind === 'customer';

  // Handle mock click to add a coordinate for scaffold preview
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || closed || !onAddPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    // Generate synthetic coordinates around Mae Hong Son demo bounding box
    // Lng: [97.950, 97.985], Lat: [19.290, 19.315]
    const syntheticLng = Number((97.95 + xRatio * 0.035).toFixed(5));
    const syntheticLat = Number((19.315 - yRatio * 0.025).toFixed(5));

    onAddPoint(activeKind, [syntheticLng, syntheticLat]);
  };

  return (
    <div
      className={`relative w-full aspect-[4/3] sm:aspect-[16/10] min-h-[280px] sm:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm flex flex-col justify-between select-none ${className}`}
    >
      {/* Visual Map Grid Pattern (SVG without external network assets) */}
      <div
        className={`absolute inset-0 bg-slate-100 opacity-100 ${
          closed ? 'cursor-default' : 'cursor-crosshair'
        }`}
        onClick={handleCanvasClick}
        role="region"
        aria-label="พื้นที่จำลองแผนที่สำหรับทดสอบการวางจุด"
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-slate-300"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />

          {/* Simple SVG mock render of coordinates */}
          {draft.coordinates.length > 0 && (
            <polyline
              points={draft.coordinates
                .map(([lng, lat]) => {
                  const x = ((lng - 97.95) / 0.035) * 100;
                  const y = ((19.315 - lat) / 0.025) * 100;
                  return `${x}%,${y}%`;
                })
                .join(' ')}
              fill={closed ? (isCustomer ? 'rgba(245, 158, 11, 0.22)' : 'rgba(37, 99, 235, 0.22)') : 'none'}
              stroke={isCustomer ? '#d97706' : '#1d4ed8'}
              strokeWidth="2.5"
              strokeDasharray={closed ? undefined : '4 4'}
            />
          )}
        </svg>

        {/* Render simulated point markers */}
        {draft.coordinates.map(([lng, lat], i) => {
          const x = ((lng - 97.95) / 0.035) * 100;
          const y = ((19.315 - lat) / 0.025) * 100;
          const isFirst = i === 0;
          const isClosing = i === draft.coordinates.length - 1 && closed;

          return (
            <div
              key={`${i}-${lng}-${lat}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[9px] font-bold text-white pointer-events-none ${
                isFirst || isClosing
                  ? 'bg-rose-600 ring-2 ring-rose-300'
                  : isCustomer
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
              }`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* Top Banner: Mode Indicator & Phase Notice */}
      <div className="relative z-10 p-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isCustomer ? 'bg-amber-500' : 'bg-blue-600'
            }`}
          />
          <span className="text-xs font-bold text-slate-900">
            {draft.label}
          </span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">
            {closed ? 'CLOSED RING' : `${draft.coordinates.length} PTS`}
          </span>
        </div>

        <div className="bg-amber-50/90 backdrop-blur-sm text-amber-900 px-2.5 py-1 rounded-md text-[11px] font-medium border border-amber-200 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Map Tile Deferred (Scaffold Only)</span>
        </div>
      </div>

      {/* Center Guidance Overlay */}
      <div className="relative z-10 pointer-events-none p-4 text-center">
        <div className="inline-block bg-white/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm max-w-sm">
          <p className="text-xs font-semibold text-slate-900 flex items-center justify-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            {closed
              ? 'รูปหลายเหลี่ยมปิดสมบูรณ์แล้ว'
              : draft.coordinates.length > 0
              ? 'คลิกบนพื้นที่เพื่อวางจุดต่อไป หรือกดปุ่ม "ปิดวง"'
              : 'คลิกบนตารางเพื่อจำลองการปักหมุดจุดขอบเขต'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Phase 2 จะเชื่อมต่อเอนจินแผนที่ Leaflet/OSM แบบโต้ตอบเต็มรูปแบบ
          </p>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="relative z-10 p-2.5 bg-white/90 backdrop-blur-sm border-t border-slate-200 flex items-center justify-between text-xs px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">
            CRS: EPSG:4326 (WGS84 [lng, lat])
          </span>
        </div>
        <div className="text-[11px] text-slate-500">
          {closed ? 'Polygon takes precedence over radius' : 'Radius active until polygon is closed'}
        </div>
      </div>
    </div>
  );
};
