'use client';

import { useState } from 'react';
import {
  revokeTelegramIdentityAction,
  sendTelegramTestToIdentityAction,
  type ManagedTelegramIdentity,
} from '@/app/actions/telegram-admin';

interface Props {
  initialRows: ManagedTelegramIdentity[];
  initialError: string | null;
}

export function TelegramAdminClient({ initialRows, initialError }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runTest = async (tgId: number) => {
    setBusy(tgId);
    setNotice(null);
    try {
      const res = await sendTelegramTestToIdentityAction(tgId);
      setNotice(res.success ? `ส่งทดสอบถึง ${tgId} แล้ว` : res.error ?? 'ส่งไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const runRevoke = async (tgId: number) => {
    if (!window.confirm(`ยกเลิกการผูกของบัญชี ${tgId}?`)) return;
    setBusy(tgId);
    setNotice(null);
    try {
      const res = await revokeTelegramIdentityAction(tgId);
      if (res.success) {
        setRows((cur) =>
          cur.map((r) =>
            r.telegram_user_id === tgId ? { ...r, revoked_at: new Date().toISOString() } : r
          )
        );
        setNotice(`ยกเลิก ${tgId} แล้ว`);
      } else {
        setError(res.error ?? 'ยกเลิกไม่สำเร็จ');
      }
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-xs text-slate-500">
        ยังไม่มีบัญชี Telegram ที่ยืนยันแล้ว
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
          {notice}
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.telegram_user_id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {row.full_name ?? row.user_id.slice(0, 8)}
                  <span className="ml-2 text-[11px] font-normal text-slate-500">
                    tg:{row.telegram_user_id} · {row.role}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  โทร {row.phone_masked} · ยืนยัน {new Date(row.verified_at).toLocaleString('th-TH')}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  ร้าน: {row.shops.length > 0 ? row.shops.map((s) => `${s.shop_name}(${s.role})`).join(', ') : '-'}
                </p>
                <p className="text-[11px] text-slate-600">
                  ไรเดอร์: {row.riders.length > 0 ? row.riders.map((r) => `${r.display_name}@${r.shop_name}`).join(', ') : '-'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                  row.revoked_at ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {row.revoked_at ? 'ยกเลิกแล้ว' : 'active'}
              </span>
            </div>
            {!row.revoked_at && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy === row.telegram_user_id}
                  onClick={() => void runTest(row.telegram_user_id)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ส่งทดสอบ
                </button>
                <button
                  type="button"
                  disabled={busy === row.telegram_user_id}
                  onClick={() => void runRevoke(row.telegram_user_id)}
                  className="rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  ยกเลิกการผูก
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
