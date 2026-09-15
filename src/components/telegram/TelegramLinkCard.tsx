'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  confirmTelegramLinkAction,
  getMyTelegramStatusAction,
  requestTelegramVerifyAction,
  unlinkTelegramAction,
} from '@/app/actions/telegram-identity';

type Status =
  | { kind: 'loading' }
  | { kind: 'unlinked' }
  | {
      kind: 'linked';
      role: string;
      shops: number;
      riders: number;
      verified_at: string;
    };

/**
 * Self-service Telegram verify card. Mounts on account/settings pages.
 * Flow: create link -> open t.me in Telegram -> press confirm here.
 */
export function TelegramLinkCard() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [link, setLink] = useState<{ url: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const res = await getMyTelegramStatusAction();
    if (!res.success) {
      setError(res.error ?? 'โหลดสถานะไม่สำเร็จ');
      setStatus({ kind: 'unlinked' });
      return;
    }
    if (res.identity) {
      setStatus({
        kind: 'linked',
        role: res.identity.role,
        shops: res.identity.shops.length,
        riders: res.identity.riders.length,
        verified_at: res.identity.verified_at,
      });
    } else {
      setStatus({ kind: 'unlinked' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await requestTelegramVerifyAction();
      if (!res.success || !res.botUrl) {
        setError(res.error ?? 'สร้างลิงก์ไม่สำเร็จ');
        return;
      }
      const token = new URL(res.botUrl).searchParams.get('start') ?? '';
      setLink({ url: res.botUrl, token });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmTelegramLinkAction(link.token);
      if (!res.success) {
        setError(res.error ?? 'ยืนยันไม่สำเร็จ');
        return;
      }
      setLink(null);
      setNotice('ยืนยันสำเร็จ! บอทจะตอบกลับใน Telegram ค่ะ');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm('ยกเลิกการผูก Telegram นี้?')) return;
    setBusy(true);
    try {
      const res = await unlinkTelegramAction();
      if (!res.success) {
        setError(res.error ?? 'ยกเลิกไม่สำเร็จ');
        return;
      }
      setNotice('ยกเลิกการผูกแล้ว');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="เชื่อม Telegram" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">🔗 เชื่อม Telegram</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
        ผูกบัญชี Telegram กับผู้ใช้นี้เพื่อรับเมนูและการแจ้งเตือนตามสิทธิ์
      </p>

      {status.kind === 'loading' && (
        <p className="mt-3 text-xs text-slate-500">กำลังโหลดสถานะ...</p>
      )}

      {status.kind === 'linked' && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-900">
            ✅ ผูกแล้ว · {status.role} · {status.shops} ร้าน · {status.riders} ไรเดอร์
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void unlink()}
            className="rounded-lg border border-rose-300 px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            ยกเลิกการผูก
          </button>
        </div>
      )}

      {status.kind === 'unlinked' && !link && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          สร้างลิงก์เชื่อม Telegram
        </button>
      )}

      {link && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] text-slate-700">1. เปิดลิงก์นี้ในแอป Telegram (อายุ 10 นาที ใช้ครั้งเดียว)</p>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] text-sky-700"
          >
            {link.url}
          </a>
          <p className="text-[11px] text-slate-700">2. กลับมากดยืนยันที่นี่</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            ยืนยันการเชื่อม
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-rose-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-[11px] text-emerald-700">
          {notice}
        </p>
      )}
    </section>
  );
}
