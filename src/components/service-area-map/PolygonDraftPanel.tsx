'use client';

import React from 'react';
import { Info, Lock, Map as MapIcon, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PolygonDraft, isClosedRing } from './types';

interface PolygonDraftPanelProps {
  draft: PolygonDraft;
  className?: string;
  readOnly?: boolean;
  mode?: 'scaffold' | 'live';
}

export const PolygonDraftPanel: React.FC<PolygonDraftPanelProps> = ({
  draft,
  className = '',
  readOnly = false,
  mode = 'scaffold',
}) => {
  const isCustomer = draft.kind === 'customer';
  const closed = isClosedRing(draft.coordinates);
  const pointCount = draft.coordinates.length;
  const numberBadgeClass = isCustomer ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white';

  const statusBadge = readOnly
    ? {
        text: 'โหมดอ่านอย่างเดียว (Locked)',
        bgClass: 'bg-slate-200 text-slate-700 border-slate-300',
        Icon: Lock,
      }
    : closed
    ? {
        text: 'ปิดวงแหวนแล้ว',
        bgClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
        Icon: ShieldCheck,
      }
    : draft.status === 'drawing'
    ? {
        text: 'กำลังวาด',
        bgClass: 'bg-amber-50 text-amber-900 border-amber-300',
        Icon: null,
      }
    : {
        text: 'ยังไม่เริ่ม',
        bgClass: 'bg-slate-100 text-slate-600 border-slate-200',
        Icon: null,
      };

  return (
    <section
      id={`panel-area-${draft.kind}`}
      role="tabpanel"
      aria-labelledby={`tab-area-${draft.kind}`}
      className={`bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm space-y-4 ${className}`}
    >
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {draft.label}
          </h3>
          <p className="text-xs text-slate-500">
            {isCustomer
              ? 'ขอบเขตควบคุมการสั่งซื้อของลูกค้าในระบบ'
              : 'ขอบเขตปฏิบัติงานและ Geofence 15 นาทีของไรเดอร์'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            สถานะ:
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${statusBadge.bgClass}`}
          >
            {statusBadge.Icon && <statusBadge.Icon className="w-3.5 h-3.5" aria-hidden="true" />}
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* System notice: polygon replaces the fallback radius */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">ข้อกำหนดระบบ:</span>{' '}
          {closed
            ? (
              <>
                วาด Polygon ปิดวงสำเร็จ — ระบบจะใช้พื้นที่รูปหลายเหลี่ยมนี้แทนค่ารัศมีวงกลมเดิม (
                <span className="font-medium underline">
                  {draft.fallbackRadiusMeters.toLocaleString()} ม.
                </span>
                ) โดยอัตโนมัติ
              </>
            ) : (
              <>
                เมื่อเปิดใช้งานพื้นที่รูปหลายเหลี่ยม ระบบจะนำขอบเขตนี้ไปใช้แทนค่ารัศมีวงกลมเดิม (
                <span className="font-semibold">
                  {draft.fallbackRadiusMeters.toLocaleString()} เมตร
                </span>
                ) โดยอัตโนมัติ หากยังไม่ปิดวงจะใช้ค่ารัศมีเดิมเป็นค่าสำรอง
              </>
            )}
        </div>
      </div>

      {/* Points & Coordinates Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
            แผงรายการจุดพิกัดที่วางไว้
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 font-mono text-[11px] text-slate-600 border border-slate-200">
            {pointCount} จุดพิกัด
          </span>
        </div>
        <p className="text-[11px] text-slate-400">ลำดับ: [ลองจิจูด (Lng), ละติจูด (Lat)]</p>

        {pointCount === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs gap-1">
            <MapIcon className="w-6 h-6 text-slate-300" aria-hidden="true" />
            <span className="font-semibold text-slate-600">ยังไม่มีจุดพิกัดในรายการ</span>
            <span>คลิกบนแผนที่เพื่อเริ่มปักหมุดจุดแรก</span>
          </div>
        ) : (
          <div className="min-h-[220px] max-h-[300px] overflow-y-auto border border-slate-200/60 rounded-lg p-2 space-y-1.5 bg-slate-50/50 text-xs font-mono">
            {draft.coordinates.map((coord, index) => {
              const isFirst = index === 0;
              const isLast = index === pointCount - 1;
              const isClosing = isLast && closed;

              return (
                <div
                  key={`${index}-${coord[0]}-${coord[1]}`}
                  className={`flex items-center justify-between p-2 rounded-md bg-white border transition-colors ${
                    isClosing
                      ? 'border-emerald-300 font-semibold text-emerald-900'
                      : 'border-slate-200/60 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className={`w-5 h-5 rounded-full font-sans font-bold text-[10px] flex items-center justify-center shrink-0 ${numberBadgeClass}`}
                      aria-hidden="true"
                    >
                      {isClosing ? '✓' : index + 1}
                    </span>
                    <span className="truncate">
                      [{coord[0].toFixed(5)}, {coord[1].toFixed(5)}]
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-sans shrink-0">
                    {isFirst && !isClosing ? 'จุดเริ่ม' : ''}{isClosing ? 'จุดปิดวง' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mode === 'scaffold' && (
        <div className="bg-slate-100 p-3 rounded-lg text-[11px] text-slate-600 flex items-center justify-between gap-2 border border-slate-200">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            โครงสร้างจำลอง UI (Scaffold Preview) — ไม่เชื่อมต่อฐานข้อมูลหรือ API จริง
          </span>
          <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
            UI-ONLY
          </span>
        </div>
      )}
    </section>
  );
};
