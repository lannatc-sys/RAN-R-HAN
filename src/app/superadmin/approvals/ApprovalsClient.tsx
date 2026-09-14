'use client';

import { useState } from 'react';
import {
  listPromptpayRequestsAction,
  reviewPromptpayRequestAction,
  type PromptpayChangeRequestItem,
} from '@/app/actions/superadmin';

function formatRequestedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function PromptpayKindLabel(value: string | null): string {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return 'เบอร์โทร 10 หลัก';
  if (digits.length === 13) return 'บัตรประชาชน 13 หลัก';
  return 'รูปแบบไม่แน่ชัด';
}

export function ApprovalsClient({
  initialRequests,
}: {
  initialRequests: PromptpayChangeRequestItem[];
}) {
  const [requests, setRequests] = useState<PromptpayChangeRequestItem[]>(initialRequests);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function refresh() {
    const res = await listPromptpayRequestsAction();
    if (res.success) {
      setRequests(res.requests ?? []);
    } else {
      setBanner({ kind: 'err', text: res.error ?? 'โหลดรายการคำขอล่าสุดไม่สำเร็จ' });
    }
  }

  async function handleReview(requestId: string, approve: boolean) {
    if (busyId) return;
    setBusyId(requestId);
    setBanner(null);
    try {
      const res = await reviewPromptpayRequestAction(requestId, approve, notes[requestId] ?? null);
      if (res.success) {
        setBanner({
          kind: 'ok',
          text: approve ? 'อนุมัติคำขอแล้ว' : 'ปฏิเสธคำขอแล้ว',
        });
        await refresh();
      } else {
        setBanner({ kind: 'err', text: res.error ?? 'ดำเนินการไม่สำเร็จ' });
      }
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">ไม่มีคำขอค้างอนุมัติ</p>
        <p className="text-xs text-slate-500 mt-1">คำขอเปลี่ยนพร้อมเพย์จากร้านค้าจะมาปรากฏที่นี่</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {banner ? (
        <div
          className={
            banner.kind === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-900'
              : 'bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-900'
          }
        >
          {banner.text}
        </div>
      ) : null}

      {requests.map((req) => {
        const busy = busyId === req.id;
        return (
          <section
            key={req.id}
            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {req.shop_name ?? 'ไม่ทราบชื่อร้าน'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ยื่นเมื่อ {formatRequestedAt(req.requested_at)}
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                รออนุมัติ
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-[11px] font-semibold text-slate-500">เลขปัจจุบัน</div>
                <div className="text-sm font-mono font-semibold text-slate-900 break-all">
                  {req.current_promptpay_id ?? '-'}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {req.current_promptpay_name ?? '-'}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-[11px] font-semibold text-emerald-700">
                  เลขที่ขอเปลี่ยน ({PromptpayKindLabel(req.requested_promptpay_id)})
                </div>
                <div className="text-sm font-mono font-semibold text-slate-900 break-all">
                  {req.requested_promptpay_id}
                </div>
                <div className="text-xs text-slate-700 mt-0.5">
                  {req.requested_promptpay_name}
                </div>
              </div>
            </div>

            {req.reason ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-700">เหตุผลจากร้าน:</span> {req.reason}
              </p>
            ) : null}

            <div>
              <label
                htmlFor={`note-${req.id}`}
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                หมายเหตุการพิจารณา (ไม่บังคับ)
              </label>
              <textarea
                id={`note-${req.id}`}
                value={notes[req.id] ?? ''}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                }
                rows={2}
                maxLength={500}
                placeholder="เช่น ตรวจสอบกับร้านแล้ว ยอดตรงกัน"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReview(req.id, true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {busy ? 'กำลังดำเนินการ…' : 'อนุมัติ'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReview(req.id, false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 text-xs font-bold transition-colors cursor-pointer"
              >
                {busy ? 'กำลังดำเนินการ…' : 'ปฏิเสธ'}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
