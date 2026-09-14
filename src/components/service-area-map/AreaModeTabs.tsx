'use client';

import React from 'react';
import { Bike, MapPin } from 'lucide-react';
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
        text: 'ปิดวงแหวนแล้ว',
        bgClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
        dotClass: 'bg-emerald-500',
      };
    case 'drawing':
      return {
        text: `กำลังวาด (${draft.coordinates.length} จุด)`,
        bgClass: 'bg-amber-50 text-amber-900 border-amber-300',
        dotClass: 'bg-amber-500',
      };
    case 'empty':
    default:
      return {
        text: 'ยังไม่เริ่ม',
        bgClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
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
      title: 'พื้นที่ลูกค้า (Customer)',
      subtitle: 'ขอบเขตที่ลูกค้าสามารถสั่งอาหาร Delivery ได้',
      draft: customerDraft,
    },
    {
      kind: 'rider',
      title: 'พื้นที่ไรเดอร์ (Rider)',
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
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-sm"
      >
        {tabs.map((tab, idx) => {
          const isSelected = activeKind === tab.kind;
          const badge = getStatusBadge(tab.draft);
          const isCustomerTab = tab.kind === 'customer';
          const TabIcon = isCustomerTab ? MapPin : Bike;

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
                focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
                ${
                  isSelected
                    ? `bg-white shadow-sm border text-slate-900 ${
                        isCustomerTab ? 'border-amber-500/40' : 'border-blue-500/40'
                      }`
                    : 'border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="font-semibold text-sm sm:text-base flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isCustomerTab ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    aria-hidden="true"
                  />
                  <TabIcon className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
                  {tab.title}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.bgClass} whitespace-nowrap`}
                >
                  <span className={`w-2 h-2 rounded-full ${badge.dotClass}`} aria-hidden="true" />
                  {badge.text}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {tab.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
