'use client';

import React from 'react';
import { PolygonDraft, isClosedRing } from './types';

interface PolygonDraftPanelProps {
  draft: PolygonDraft;
  className?: string;
}

export const PolygonDraftPanel: React.FC<PolygonDraftPanelProps> = ({ draft, className = '' }) => {
  const isCustomer = draft.kind === 'customer';
  const closed = isClosedRing(draft.coordinates);
  const pointCount = draft.coordinates.length;

  return (
    <section
      id={`panel-area-${draft.kind}`}
      role="tabpanel"
      aria-labelledby={`tab-area-${draft.kind}`}
      className={`bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 ${className}`}
    >
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {draft.label}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isCustomer
              ? 'ขอบเขตควบคุมการสั่งซื้อของลูกค้าในระบบ'
              : 'ขอบเขตปฏิบัติงานและ Geofence 15 นาทีของไรเดอร์'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            สถานะ:
          </span>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              closed
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : draft.status === 'drawing'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
            }`}
          >
            {closed
              ? '✓ ปิดรูปหลายเหลี่ยมแล้ว'
              : draft.status === 'drawing'
              ? '✎ กำลังวาดจุด'
              : '○ ยังไม่มีพิกัด'}
          </span>
        </div>
      </div>

      {/* Precedence Notice Box (Contract Requirement: Polygon overrides Radius) */}
      <div
        className={`p-3.5 rounded-lg text-xs leading-relaxed border ${
          closed
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
            : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200'
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="text-base" aria-hidden="true">
            {closed ? '🛡️' : 'ℹ️'}
          </span>
          <div className="space-y-1">
            <p className="font-bold">
              {closed
                ? 'วาด Polygon ปิดวงสำเร็จ — จะมีผลทับค่ารัศมีเดิมทันทีที่บันทึก'
                : 'ลำดับการบังคับใช้: วาด Polygon แล้วจะทับค่ารัศมีเดิม'}
            </p>
            <p className="opacity-90">
              {closed ? (
                <>
                  ระบบในฐานข้อมูล (ฟังก์ชัน <code>is_point_in_shop_area</code>) จะใช้พื้นที่
                  รูปหลายเหลี่ยมนี้แทนที่รัศมีวงกลมเดิม (
                  <span className="font-medium underline">
                    {draft.fallbackRadiusMeters.toLocaleString()} ม.
                  </span>
                  ) เพื่อความแม่นยำตามแนวถนนหรือเขตการปกครองจริง
                </>
              ) : (
                <>
                  หากยังไม่ได้วาดรูปหลายเหลี่ยมหรือยังไม่ได้ปิดวง ระบบจะใช้ค่ารัศมีวงกลมเดิม{' '}
                  <span className="font-semibold">
                    ({draft.fallbackRadiusMeters.toLocaleString()} เมตร)
                  </span>{' '}
                  เป็นค่าสำรอง (Fallback) อัตโนมัติ
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Points & Coordinates Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>พิกัดจุดบนขอบเขต ({pointCount} จุด)</span>
          <span className="text-slate-400">ลำดับ: [ลองจิจูด (Lng), ละติจูด (Lat)]</span>
        </div>

        {pointCount === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs">
            ยังไม่มีจุดพิกัด คลิกบนแผนที่เพื่อเริ่มปักหมุดจุดแรก
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-950/40 text-xs font-mono">
            {draft.coordinates.map((coord, index) => {
              const isFirst = index === 0;
              const isLast = index === pointCount - 1;
              const isClosing = isLast && closed;

              return (
                <div
                  key={`${index}-${coord[0]}-${coord[1]}`}
                  className={`flex items-center justify-between py-1 px-2 rounded ${
                    isClosing
                      ? 'bg-emerald-100/70 dark:bg-emerald-950/60 font-semibold text-emerald-800 dark:text-emerald-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-[11px] opacity-75 font-sans">
                    #{index + 1} {isFirst && '(จุดเริ่ม)'} {isClosing && '(จุดปิดวง)'}
                  </span>
                  <span>
                    [{coord[0].toFixed(5)}, {coord[1].toFixed(5)}]
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scaffold Sandbox Alert */}
      <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700">
        <span>⚠️ โครงสร้างจำลอง UI (Scaffold Preview) — ไม่เชื่อมต่อฐานข้อมูลหรือ API จริง</span>
        <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
          UI-ONLY
        </span>
      </div>
    </section>
  );
};
