'use client';

import React, { useState } from 'react';
import {
  AreaKind,
  LngLat,
  MapCanvasRenderProps,
  PolygonDraft,
  ServiceAreaMapEditorActions,
  ServiceAreaMapEditorState,
} from './types';
import { DEMO_INITIAL_EDITOR_STATE } from './fixtures';
import { AreaModeTabs } from './AreaModeTabs';
import { MapCanvasPlaceholder } from './MapCanvasPlaceholder';
import { PolygonDraftPanel } from './PolygonDraftPanel';
import { EditorToolbar } from './EditorToolbar';

const defaultRenderCanvas = (props: MapCanvasRenderProps) => (
  <MapCanvasPlaceholder {...props} />
);

export interface ServiceAreaMapEditorShellProps {
  /** Initial or controlled state */
  initialState?: ServiceAreaMapEditorState;
  /** Action callbacks from parent */
  actions?: Partial<ServiceAreaMapEditorActions>;
  /** Disable interactions */
  readOnly?: boolean;
  /**
   * Supplies the map surface. Defaults to the offline placeholder so the
   * scaffold never pulls in a map library or reaches the network on its own.
   */
  renderCanvas?: (props: MapCanvasRenderProps) => React.ReactNode;
  /**
   * 'scaffold' คือหน้าสาธิตที่ไม่ต่อฐานข้อมูล ใช้ป้ายเตือนและปุ่มบันทึกจำลอง
   * 'live' คือหน้าจริงที่ผู้เรียกมีปุ่มบันทึกของตัวเองและเขียนฐานข้อมูลจริง
   *
   * โหมด live ต้องไม่มีป้าย "แยกขาดจากฐานข้อมูลจริง" และต้องไม่มีปุ่มบันทึกจำลอง
   * ปนอยู่ ไม่งั้นผู้ใช้กดผิดปุ่มแล้วเข้าใจว่าบันทึกไปแล้วทั้งที่ไม่มีอะไรถูกเขียน
   */
  mode?: 'scaffold' | 'live';
}

export const ServiceAreaMapEditorShell: React.FC<ServiceAreaMapEditorShellProps> = ({
  initialState = DEMO_INITIAL_EDITOR_STATE,
  actions,
  readOnly = false,
  renderCanvas,
  mode = 'scaffold',
}) => {
  const isLive = mode === 'live';
  // Local state for scaffold preview interaction
  const [activeKind, setActiveKind] = useState<AreaKind>(initialState.activeAreaKind);
  const [customerDraft, setCustomerDraft] = useState<PolygonDraft>(initialState.customerDraft);
  const [riderDraft, setRiderDraft] = useState<PolygonDraft>(initialState.riderDraft);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const currentDraft = activeKind === 'customer' ? customerDraft : riderDraft;
  const setCurrentDraft = (updater: (prev: PolygonDraft) => PolygonDraft) => {
    if (activeKind === 'customer') {
      setCustomerDraft(updater);
    } else {
      setRiderDraft(updater);
    }
  };

  const handleSelectAreaKind = (kind: AreaKind) => {
    setActiveKind(kind);
    actions?.onSelectAreaKind?.(kind);
    setFeedbackMessage(null);
  };

  const handleAddPoint = (kind: AreaKind, point: LngLat) => {
    if (readOnly) return;
    setCurrentDraft((prev) => {
      const nextCoords = [...prev.coordinates, point];
      return {
        ...prev,
        coordinates: nextCoords,
        status: 'drawing',
        updatedAt: new Date().toISOString(),
      };
    });
    actions?.onAddPoint?.(kind, point);
    setFeedbackMessage(`เพิ่มพิกัดจุด [${point[0].toFixed(4)}, ${point[1].toFixed(4)}]`);
  };

  const handleUndoPoint = (kind: AreaKind) => {
    if (readOnly) return;
    setCurrentDraft((prev) => {
      if (prev.coordinates.length === 0) return prev;
      const nextCoords = prev.coordinates.slice(0, -1);
      return {
        ...prev,
        coordinates: nextCoords,
        status: nextCoords.length === 0 ? 'empty' : 'drawing',
        updatedAt: new Date().toISOString(),
      };
    });
    actions?.onUndoPoint?.(kind);
    setFeedbackMessage('ย้อนกลับพิกัดล่าสุด 1 จุด');
  };

  const handleResetDraft = (kind: AreaKind) => {
    if (readOnly) return;
    setCurrentDraft((prev) => ({
      ...prev,
      coordinates: [],
      status: 'empty',
      updatedAt: new Date().toISOString(),
    }));
    actions?.onResetDraft?.(kind);
    setFeedbackMessage('ล้างพิกัดร่างทั้งหมดเรียบร้อย');
  };

  const handleCloseRing = (kind: AreaKind) => {
    if (readOnly) return;
    setCurrentDraft((prev) => {
      if (prev.coordinates.length < 3) return prev;
      // Close ring: connect last coordinate to first coordinate
      const firstCoord = prev.coordinates[0];
      const nextCoords = [...prev.coordinates, firstCoord];
      return {
        ...prev,
        coordinates: nextCoords,
        status: 'closed',
        updatedAt: new Date().toISOString(),
      };
    });
    actions?.onCloseRing?.(kind);
    setFeedbackMessage('ปิดรูปหลายเหลี่ยมเรียบร้อยแล้ว (จะทับค่ารัศมีเดิมเมื่อบันทึก)');
  };

  const handleSavePlaceholder = (kind: AreaKind) => {
    actions?.onSavePlaceholder?.(kind);
    setFeedbackMessage('จำลองการบันทึกขอบเขต (Scaffold Preview Only — ไม่มีการส่งข้อมูลไปยังเซิร์ฟเวอร์)');
  };

  const toolbarSave = isLive ? undefined : handleSavePlaceholder;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Banner — ข้อความต่างกันตามโหมด */}
      <header
        className={`rounded-xl p-4 shadow-sm border ${
          isLive
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="text-xl" aria-hidden="true">
              🗺️
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                ระบบจัดการขอบเขตพื้นที่บริการด้วยรูปหลายเหลี่ยม (Service Area Map Editor)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isLive
                  ? 'คลิกบนแผนที่เพื่อวางจุด คลิกจุดแรกซ้ำเพื่อปิดวงแหวน แล้วกดปุ่มบันทึกพื้นที่ด้านบน'
                  : 'โครงร่างหน้าจอจำลอง (Scaffold UI) — แยกขาดจากฐานข้อมูลจริง เพื่อการทดสอบ UX/UI ก่อนเชื่อมต่อ Leaflet Engine'}
              </p>
            </div>
          </div>
          {!isLive && (
            <span className="self-start sm:self-center text-xs bg-amber-200/70 text-amber-900 font-semibold px-2.5 py-1 rounded-full border border-amber-300 whitespace-nowrap">
              SCAFFOLD MODE
            </span>
          )}
        </div>
      </header>

      {/* Tabs for Customer vs Rider area */}
      <AreaModeTabs
        activeKind={activeKind}
        customerDraft={customerDraft}
        riderDraft={riderDraft}
        onSelectKind={handleSelectAreaKind}
        disabled={readOnly}
      />

      {/* Interactive Feedback Toast (Mock) */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3.5 py-2 rounded-lg flex items-center justify-between"
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-blue-500 hover:text-blue-700 ml-2 font-bold"
            aria-label="ปิดการแจ้งเตือน"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Grid: Map Canvas (Left/Center) + Draft Info Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left/Center Column: Canvas & Toolbar */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {(renderCanvas ?? defaultRenderCanvas)({
            draft: currentDraft,
            activeKind,
            onAddPoint: handleAddPoint,
            disabled: readOnly,
          })}
          <EditorToolbar
            draft={currentDraft}
            onCloseRing={handleCloseRing}
            onUndoPoint={handleUndoPoint}
            onResetDraft={handleResetDraft}
            onSavePlaceholder={toolbarSave}
            disabled={readOnly}
          />
        </div>

        {/* Right Column: Detailed Polygon Properties & Precedence Status */}
        <div className="lg:col-span-5 xl:col-span-4">
          <PolygonDraftPanel draft={currentDraft} readOnly={readOnly} mode={mode} />
        </div>
      </div>
    </div>
  );
};
