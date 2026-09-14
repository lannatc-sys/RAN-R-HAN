'use client';

import React from 'react';
import { CircleDot, Save, Trash2, Undo2 } from 'lucide-react';
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
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
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
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
            ${
              canClose
                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          <CircleDot className="w-4 h-4" aria-hidden="true" />
          <span>ปิดวง (Close Ring)</span>
        </button>

        {/* Undo Last Point */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => onUndoPoint?.(draft.kind)}
          aria-label="ย้อนกลับพิกัดจุดล่าสุดหนึ่งจุด"
          className={`
            min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 border
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
            ${
              canUndo
                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer'
                : 'bg-slate-100/50 border-slate-200 text-slate-300 cursor-not-allowed'
            }
          `}
        >
          <Undo2 className="w-4 h-4" aria-hidden="true" />
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
            focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2
            ${
              canReset
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer border border-rose-200'
                : 'bg-slate-100/50 text-slate-300 cursor-not-allowed'
            }
          `}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          <span>ล้างจุด (Clear)</span>
        </button>
      </div>

      {/*
        ปุ่มบันทึกจำลอง มีเฉพาะโหมด scaffold
        หน้าจริงส่ง onSavePlaceholder เป็น undefined เข้ามาและมีปุ่มบันทึกของตัวเอง
        ถ้ายังโชว์ปุ่มนี้ผู้ใช้จะกดผิดแล้วเข้าใจว่าบันทึกแล้วทั้งที่ไม่มีอะไรถูกเขียน
      */}
      {onSavePlaceholder && (
      <div className="w-full sm:w-auto flex justify-end">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSavePlaceholder?.(draft.kind)}
          aria-label="บันทึกขอบเขตพื้นที่จำลอง (Scaffold Mock Save)"
          className={`
            w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
            ${
              canSave
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>บันทึกพื้นที่ (Scaffold Mock)</span>
        </button>
      </div>
      )}
    </div>
  );
};
