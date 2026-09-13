'use client';

import React from 'react';
import { AreaKind, PolygonDraft, isClosedRing } from './types';

interface EditorToolbarProps {
  draft: PolygonDraft;
  onCloseRing?: (kind: AreaKind) => void;
  onUndoPoint?: (kind: AreaKind) => void;
  onResetDraft?: (kind: AreaKind) => void;
  onSavePlaceholder?: (kind: AreaKind) => void;
  disabled?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  draft,
  onCloseRing,
  onUndoPoint,
  onResetDraft,
  onSavePlaceholder,
  disabled = false,
}) => {
  const points = draft.coordinates;
  const closed = isClosedRing(points);
  const canClose = !closed && points.length >= 3 && !disabled;
  const canUndo = points.length > 0 && !disabled;
  const canReset = points.length > 0 && !disabled;
  const canSave = closed && !disabled;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Left: Draft Editing Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Close Ring Button */}
        <button
          type="button"
          disabled={!canClose}
          onClick={() => onCloseRing?.(draft.kind)}
          aria-label="ปิดรูปหลายเหลี่ยมโดยเชื่อมจุดสุดท้ายเข้ากับจุดเริ่มต้น"
          className={`
            min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5
            focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
            ${
              canClose
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <span aria-hidden="true">🔒</span>
          <span>ปิดวง (Close Ring)</span>
        </button>

        {/* Undo Last Point */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => onUndoPoint?.(draft.kind)}
          aria-label="ย้อนกลับพิกัดจุดล่าสุดหนึ่งจุด"
          className={`
            min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
            ${
              canUndo
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer'
                : 'bg-slate-100/50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-700 cursor-not-allowed'
            }
          `}
        >
          <span aria-hidden="true">↩️</span>
          <span>ย้อนกลับ (Undo)</span>
        </button>

        {/* Clear All Points */}
        <button
          type="button"
          disabled={!canReset}
          onClick={() => onResetDraft?.(draft.kind)}
          aria-label="ล้างพิกัดทั้งหมดในร่างนี้"
          className={`
            min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5
            focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
            ${
              canReset
                ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 cursor-pointer border border-rose-200 dark:border-rose-900'
                : 'bg-slate-100/50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-700 cursor-not-allowed'
            }
          `}
        >
          <span aria-hidden="true">🗑️</span>
          <span>ล้างจุด (Clear)</span>
        </button>
      </div>

      {/* Right: Mock Save Placeholder Button */}
      <div className="w-full sm:w-auto flex justify-end">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSavePlaceholder?.(draft.kind)}
          aria-label="บันทึกขอบเขตพื้นที่จำลอง (Scaffold Mock Save)"
          className={`
            w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
            ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <span aria-hidden="true">💾</span>
          <span>บันทึกพื้นที่ (Scaffold Mock)</span>
        </button>
      </div>
    </div>
  );
};
