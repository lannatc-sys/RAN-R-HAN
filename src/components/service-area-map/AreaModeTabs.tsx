'use client';

import React from 'react';
import { AreaKind, PolygonDraft } from './types';

interface AreaModeTabsProps {
  activeKind: AreaKind;
  customerDraft: PolygonDraft;
  riderDraft: PolygonDraft;
  onSelectKind: (kind: AreaKind) => void;
  disabled?: boolean;
}

function getStatusBadge(draft: PolygonDraft) {
  switch (draft.status) {
    case 'closed':
      return {
        text: 'Polygon ปิดวงแล้ว (ทับค่ารัศมีเดิม)',
        bgClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'drawing':
      return {
        text: `กำลังวาด (${draft.coordinates.length} จุด)`,
        bgClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'empty':
    default:
      return {
        text: 'ยังไม่วาด (ใช้รัศมีเดิม)',
        bgClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      };
  }
}

export const AreaModeTabs: React.FC<AreaModeTabsProps> = ({
  activeKind,
  customerDraft,
  riderDraft,
  onSelectKind,
  disabled = false,
}) => {
  const tabs: {
    kind: AreaKind;
    title: string;
    subtitle: string;
    draft: PolygonDraft;
  }[] = [
    {
      kind: 'customer',
      title: '📍 พื้นที่ลูกค้า (Customer)',
      subtitle: 'ขอบเขตที่ลูกค้าสามารถสั่งอาหาร Delivery ได้',
      draft: customerDraft,
    },
    {
      kind: 'rider',
      title: '🛵 พื้นที่ไรเดอร์ (Rider)',
      subtitle: 'ขอบเขตการวิ่งรับงานและจับเวลา Geofence',
      draft: riderDraft,
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      onSelectKind(tabs[nextIndex].kind);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      onSelectKind(tabs[prevIndex].kind);
    }
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="เลือกพื้นที่สำหรับกำหนดขอบเขต"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700"
      >
        {tabs.map((tab, idx) => {
          const isSelected = activeKind === tab.kind;
          const badge = getStatusBadge(tab.draft);

          return (
            <button
              key={tab.kind}
              role="tab"
              type="button"
              id={`tab-area-${tab.kind}`}
              aria-selected={isSelected}
              aria-controls={`panel-area-${tab.kind}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={disabled}
              onClick={() => onSelectKind(tab.kind)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`
                min-h-[44px] p-3 text-left rounded-lg transition-all flex flex-col justify-between gap-1
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
                ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="font-semibold text-sm sm:text-base">{tab.title}</span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.bgClass} whitespace-nowrap`}
                >
                  {badge.text}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {tab.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
