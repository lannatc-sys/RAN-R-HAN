'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage, LanguageToggle } from '@/lib/i18n/LanguageContext';
import { ThemeToggle } from '@/lib/theme/ThemeContext';
import { getRiderT } from '@/lib/i18n/rider-translations';
import {
  gpsPingIntervalMs,
  isPodRequired,
  mapsNavigationUrl,
  nextRiderEvent,
  offerSecondsLeft,
  splitDeliveryFee,
  type DeliveryEventType,
} from '@/lib/rider';
import {
  Bike, Power, MapPin, Navigation, Phone, Camera, Loader2,
  AlertCircle, CheckCircle2, WifiOff, LogOut, Wallet, PackageCheck,
} from 'lucide-react';

const POLL_INTERVAL_MS = 5000;
const SUMMARY_INTERVAL_MS = 60000;

interface RiderProfile {
  id: string;
  shop_id: string;
  display_name: string;
  phone: string;
  status: string;
  vehicle_type: string;
}

interface WorkSession {
  id: string;
  started_at: string;
}

interface ActiveOrder {
  id: string;
  order_no: number | string | null;
  total: number | null;
  delivery_fee: number | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  dispatch_status: string | null;
  last_event: DeliveryEventType | null;
}

interface ShopInfo {
  name: string | null;
  address: string | null;
  phone: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
}

interface OfferPayload {
  id: string;
  order_id: string;
  timeout_at: string | null;
  order: {
    order_no: number | string | null;
    total: number | null;
    delivery_fee: number | null;
    delivery_address: string | null;
    estimated_distance_km: number | null;
    customer_name: string | null;
  } | null;
}

export function RiderClient({
  rider,
  initialSession,
}: {
  rider: RiderProfile | null;
  initialSession: WorkSession | null;
}) {
  const router = useRouter();
  const { lang } = useLanguage();
  const rt = getRiderT(lang);

  const [session, setSession] = useState<WorkSession | null>(initialSession);
  const [offer, setOffer] = useState<OfferPayload | null>(null);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [summary, setSummary] = useState<{ delivered_today: number; estimated_payout: number }>({
    delivered_today: 0,
    estimated_payout: 0,
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isOnlineNetwork, setIsOnlineNetwork] = useState(true);
  const [tick, setTick] = useState(0);
  const [podFile, setPodFile] = useState<File | null>(null);
  const [breakdownNote, setBreakdownNote] = useState('');

  const coordsRef = useRef<{ lat: number; lng: number; accuracy?: number; heading?: number; speed?: number } | null>(null);

  const hasOpenSession = !!session;
  const hasActiveJob = orders.length > 0;
  const pingIntervalMs = gpsPingIntervalMs(hasOpenSession, hasActiveJob);

  /* ---------------------------------- network ---------------------------------- */
  useEffect(() => {
    const on = () => setIsOnlineNetwork(true);
    const off = () => setIsOnlineNetwork(false);
    setIsOnlineNetwork(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* --------------------------------- countdown --------------------------------- */
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ------------------------------- data fetching ------------------------------- */
  const refreshJobs = useCallback(async () => {
    if (!rider) return;
    try {
      const [offerRes, ordersRes] = await Promise.all([
        fetch('/api/rider/offers/active', { cache: 'no-store' }),
        fetch('/api/rider/orders/active', { cache: 'no-store' }),
      ]);

      if (offerRes.ok) {
        const data = await offerRes.json();
        setOffer(data.offer ?? null);
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders ?? []);
        setShop(data.shop ?? null);
      }
    } catch {
      // เงียบไว้ — ตัวชี้วัดสถานะเน็ตจัดการแยกอยู่แล้ว
    }
  }, [rider]);

  const refreshSummary = useCallback(async () => {
    if (!rider) return;
    try {
      const res = await fetch('/api/rider/summary', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSummary({
          delivered_today: data.delivered_today ?? 0,
          estimated_payout: data.estimated_payout ?? 0,
        });
      }
    } catch {
      /* noop */
    }
  }, [rider]);

  useEffect(() => {
    if (!rider) return;
    refreshJobs();
    refreshSummary();
  }, [rider, refreshJobs, refreshSummary]);

  useEffect(() => {
    if (!rider || !hasOpenSession) return;
    const jobId = window.setInterval(refreshJobs, POLL_INTERVAL_MS);
    const sumId = window.setInterval(refreshSummary, SUMMARY_INTERVAL_MS);
    return () => {
      window.clearInterval(jobId);
      window.clearInterval(sumId);
    };
  }, [rider, hasOpenSession, refreshJobs, refreshSummary]);

  /* ----------------------------------- GPS ------------------------------------ */
  useEffect(() => {
    if (!hasOpenSession) {
      coordsRef.current = null;
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(rt.gpsDenied);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        coordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          heading: pos.coords.heading ?? undefined,
          speed: typeof pos.coords.speed === 'number' ? pos.coords.speed * 3.6 : undefined,
        };
      },
      () => setGpsError(rt.gpsDenied),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasOpenSession, rt.gpsDenied]);

  useEffect(() => {
    if (pingIntervalMs <= 0) return;

    const send = async () => {
      const c = coordsRef.current;
      if (!c) return;
      try {
        await fetch('/api/rider/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c),
        });
      } catch {
        /* noop — online-first: พิกัดหลุดไม่ทำให้ flow งานพัง */
      }
    };

    send();
    const id = window.setInterval(send, pingIntervalMs);
    return () => window.clearInterval(id);
  }, [pingIntervalMs]);

  /* ---------------------------------- actions --------------------------------- */
  const showError = (text: string) => setMessage({ type: 'error', text });

  const startWork = async () => {
    if (!rider) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rider/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: rider.shop_id,
          device_info: { ua: navigator.userAgent, lang },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error ?? rt.retry);
        return;
      }
      setSession({ id: data.session_id, started_at: data.started_at });
      refreshJobs();
    } catch {
      showError(rt.offlineNetwork);
    } finally {
      setBusy(false);
    }
  };

  const closeSystem = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rider/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error ?? rt.retry);
        return;
      }
      setSession(null);
      setOffer(null);
      coordsRef.current = null;
    } catch {
      showError(rt.offlineNetwork);
    } finally {
      setBusy(false);
    }
  };

  const respondOffer = async (action: 'accept' | 'reject') => {
    if (!offer) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/rider/offer/${offer.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error ?? rt.retry);
      }
      setOffer(null);
      await refreshJobs();
    } catch {
      showError(rt.offlineNetwork);
    } finally {
      setBusy(false);
    }
  };

  const sendEvent = async (order: ActiveOrder, eventType: DeliveryEventType) => {
    const needsPod = isPodRequired(eventType);

    if (needsPod && !podFile) {
      showError(rt.podRequired);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const c = coordsRef.current;

      // POD ต้องอัปโหลดสำเร็จ "ก่อน" บันทึก Event ปิดงานเสมอ (§9.1)
      // ถ้าอัปโหลดพลาด งานจะยังไม่ถูกบันทึกเป็นส่งสำเร็จ
      let podId: string | null = null;

      if (needsPod && podFile) {
        const form = new FormData();
        form.append('file', podFile);
        form.append('event_type', eventType);
        if (c) {
          form.append('gps_lat', String(c.lat));
          form.append('gps_lng', String(c.lng));
        }

        const podRes = await fetch(`/api/rider/order/${order.id}/pod`, { method: 'POST', body: form });
        const podData = await podRes.json().catch(() => ({}));

        if (!podRes.ok || !podData.pod_id) {
          showError(podData.error ?? rt.retry);
          return;
        }
        podId = podData.pod_id as string;
      }

      const eventRes = await fetch(`/api/rider/order/${order.id}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          gps_lat: c?.lat ?? null,
          gps_lng: c?.lng ?? null,
          note: eventType === 'breakdown' ? (breakdownNote || null) : null,
          pod_id: podId,
        }),
      });
      const eventData = await eventRes.json().catch(() => ({}));

      if (!eventRes.ok) {
        showError(eventData.error ?? rt.retry);
        return;
      }

      setPodFile(null);
      setBreakdownNote('');
      setMessage({ type: 'success', text: stepLabel(rt, eventType) });
      await Promise.all([refreshJobs(), refreshSummary()]);
    } catch {
      showError(rt.offlineNetwork);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/rider/login');
    router.refresh();
  };

  /* --------------------------------- rendering -------------------------------- */
  const secondsLeft = useMemo(
    () => offerSecondsLeft(offer?.timeout_at ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offer?.timeout_at, tick]
  );

  useEffect(() => {
    if (offer && secondsLeft === 0) setOffer(null);
  }, [offer, secondsLeft]);

  if (!rider) {
    return (
      <StatusScreen icon={<AlertCircle className="w-8 h-8 text-amber-600" />} title={rt.appName} text={rt.notARider}>
        <button onClick={signOut} className="mt-6 min-h-[48px] px-6 rounded-2xl border border-stone-300 dark:border-stone-700 font-semibold">
          {rt.signOut}
        </button>
      </StatusScreen>
    );
  }

  if (rider.status !== 'active') {
    return (
      <StatusScreen icon={<AlertCircle className="w-8 h-8 text-red-600" />} title={rider.display_name} text={rt.suspended}>
        <button onClick={signOut} className="mt-6 min-h-[48px] px-6 rounded-2xl border border-stone-300 dark:border-stone-700 font-semibold">
          {rt.signOut}
        </button>
      </StatusScreen>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 pb-16 pt-safe">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{rider.display_name}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{shop?.name ?? rt.appName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LanguageToggle />
          <ThemeToggle />
          <button onClick={signOut} aria-label={rt.signOut} className="p-2 rounded-xl border border-stone-200 dark:border-stone-700">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {!isOnlineNetwork && (
        <Banner tone="warn" icon={<WifiOff className="w-4 h-4" />}>{rt.offlineNetwork}</Banner>
      )}
      {gpsError && hasOpenSession && (
        <Banner tone="warn" icon={<MapPin className="w-4 h-4" />}>{gpsError}</Banner>
      )}
      {message && (
        <Banner tone={message.type === 'error' ? 'error' : 'success'} icon={message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}>
          {message.text}
        </Banner>
      )}

      {/* Work session */}
      <section className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            hasOpenSession
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${hasOpenSession ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
            {hasOpenSession ? rt.online : rt.offline}
          </span>
          {hasOpenSession && session && (
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {rt.startedAt} {new Date(session.started_at).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <button
          onClick={hasOpenSession ? closeSystem : startWork}
          disabled={busy}
          className={`w-full min-h-[56px] rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
            hasOpenSession ? 'bg-stone-700 hover:bg-stone-800' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
          {hasOpenSession ? rt.closeSystem : rt.startWork}
        </button>

        <p className="mt-2 text-xs text-center text-stone-500 dark:text-stone-400">
          {hasOpenSession
            ? `${rt.gpsOn} ${Math.round(pingIntervalMs / 1000)} ${rt.seconds}`
            : rt.offlineHint}
        </p>
      </section>

      {/* Offer */}
      {offer && (
        <section className="rounded-3xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-amber-800 dark:text-amber-300">{rt.newOffer}</h2>
            <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
              {rt.expiresIn} {secondsLeft}s
            </span>
          </div>
          <dl className="text-sm space-y-1 mb-3">
            <Row label={rt.orderNo} value={`#${offer.order?.order_no ?? '-'}`} />
            <Row label={rt.address} value={offer.order?.delivery_address ?? '-'} />
            <Row
              label={rt.yourPayout}
              value={`${splitDeliveryFee(Number(offer.order?.delivery_fee ?? 0)).riderPayout.toLocaleString()} ${rt.baht}`}
            />
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => respondOffer('reject')}
              disabled={busy}
              className="min-h-[52px] rounded-2xl border border-stone-300 dark:border-stone-600 font-bold disabled:opacity-60"
            >
              {rt.reject}
            </button>
            <button
              onClick={() => respondOffer('accept')}
              disabled={busy || !isOnlineNetwork}
              className="min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-60"
            >
              {rt.accept}
            </button>
          </div>
        </section>
      )}

      {/* Active jobs */}
      <section className="mb-4">
        <h2 className="text-sm font-bold mb-2 text-stone-600 dark:text-stone-300">{rt.activeJob}</h2>
        {orders.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-stone-300 dark:border-stone-700 p-6 text-center text-sm text-stone-500 dark:text-stone-400">
            {hasOpenSession ? rt.noOffer : rt.noActiveJob}
          </p>
        ) : (
          orders.map((order) => (
            <JobCard
              key={order.id}
              order={order}
              shop={shop}
              rt={rt}
              busy={busy}
              podFile={podFile}
              onPickPod={setPodFile}
              breakdownNote={breakdownNote}
              onBreakdownNote={setBreakdownNote}
              onEvent={(evt) => sendEvent(order, evt)}
            />
          ))
        )}
      </section>

      {/* Summary */}
      <section className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
        <h2 className="text-sm font-bold mb-3 text-stone-600 dark:text-stone-300">{rt.todaySummary}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-stone-50 dark:bg-stone-800 p-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <PackageCheck className="w-3.5 h-3.5" /> {rt.deliveredToday}
            </div>
            <p className="text-2xl font-bold">{summary.delivered_today} <span className="text-sm font-normal">{rt.jobs}</span></p>
          </div>
          <div className="rounded-2xl bg-stone-50 dark:bg-stone-800 p-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <Wallet className="w-3.5 h-3.5" /> {rt.estimatedPayout}
            </div>
            <p className="text-2xl font-bold">{summary.estimated_payout.toLocaleString()} <span className="text-sm font-normal">{rt.baht}</span></p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">{rt.payoutDisclaimer}</p>
      </section>
    </main>
  );
}

/* --------------------------------- sub views -------------------------------- */

/** ป้ายชื่อปุ่มของแต่ละขั้นตอนงาน (map DeliveryEventType → คำแปล) */
function stepLabel(rt: ReturnType<typeof getRiderT>, evt: DeliveryEventType): string {
  return (rt as unknown as Record<string, string>)[`step_${evt}`] ?? evt;
}

function JobCard({
  order, shop, rt, busy, podFile, onPickPod, breakdownNote, onBreakdownNote, onEvent,
}: {
  order: ActiveOrder;
  shop: ShopInfo | null;
  rt: ReturnType<typeof getRiderT>;
  busy: boolean;
  podFile: File | null;
  onPickPod: (f: File | null) => void;
  breakdownNote: string;
  onBreakdownNote: (v: string) => void;
  onEvent: (evt: DeliveryEventType) => void;
}) {
  const next = nextRiderEvent(order.last_event);
  const payout = splitDeliveryFee(Number(order.delivery_fee ?? 0)).riderPayout;
  const shopUrl = mapsNavigationUrl(shop?.shop_lat, shop?.shop_lng, shop?.address ?? undefined);
  const customerUrl = mapsNavigationUrl(order.delivery_lat, order.delivery_lng, order.delivery_address ?? undefined);

  return (
    <article className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">{rt.orderNo} #{order.order_no ?? '-'}</h3>
        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
          +{payout.toLocaleString()} {rt.baht}
        </span>
      </div>

      <dl className="text-sm space-y-1 mb-3">
        <Row label={rt.customer} value={order.customer_name ?? '-'} />
        <Row label={rt.address} value={order.delivery_address ?? '-'} />
        {order.note && <Row label={rt.noteLabel} value={order.note} />}
      </dl>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {shopUrl && (
          <a href={shopUrl} target="_blank" rel="noopener noreferrer"
            className="min-h-[44px] rounded-2xl border border-stone-300 dark:border-stone-700 text-sm font-semibold flex items-center justify-center gap-1.5">
            <Navigation className="w-4 h-4" /> {rt.navigateShop}
          </a>
        )}
        {customerUrl && (
          <a href={customerUrl} target="_blank" rel="noopener noreferrer"
            className="min-h-[44px] rounded-2xl border border-stone-300 dark:border-stone-700 text-sm font-semibold flex items-center justify-center gap-1.5">
            <MapPin className="w-4 h-4" /> {rt.navigateCustomer}
          </a>
        )}
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`}
            className="min-h-[44px] rounded-2xl border border-stone-300 dark:border-stone-700 text-sm font-semibold flex items-center justify-center gap-1.5 col-span-2">
            <Phone className="w-4 h-4" /> {rt.callCustomer}
          </a>
        )}
      </div>

      {next && isPodRequired(next) && (
        <PodPicker rt={rt} podFile={podFile} onPickPod={onPickPod} />
      )}

      {next ? (
        <button
          onClick={() => onEvent(next)}
          disabled={busy}
          className="w-full min-h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {stepLabel(rt, next)}
        </button>
      ) : (
        <p className="text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400 py-3">
          {rt.jobDone}
        </p>
      )}

      {next && (
        <details className="mt-3">
          <summary className="text-xs text-stone-500 dark:text-stone-400 cursor-pointer">
            {rt.step_unreachable_drop} / {rt.step_breakdown}
          </summary>
          <div className="mt-2 space-y-2">
            {!isPodRequired(next) && (
              <PodPicker rt={rt} podFile={podFile} onPickPod={onPickPod} />
            )}
            <input
              type="text"
              value={breakdownNote}
              onChange={(e) => onBreakdownNote(e.target.value)}
              placeholder={rt.notePlaceholder}
              className="w-full min-h-[44px] px-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onEvent('unreachable_drop')}
                disabled={busy}
                className="min-h-[44px] rounded-2xl border border-amber-500 text-amber-700 dark:text-amber-400 text-sm font-semibold disabled:opacity-60"
              >
                {rt.step_unreachable_drop}
              </button>
              <button
                onClick={() => onEvent('breakdown')}
                disabled={busy}
                className="min-h-[44px] rounded-2xl border border-red-500 text-red-700 dark:text-red-400 text-sm font-semibold disabled:opacity-60"
              >
                {rt.step_breakdown}
              </button>
            </div>
          </div>
        </details>
      )}
    </article>
  );
}

function PodPicker({
  rt, podFile, onPickPod,
}: {
  rt: ReturnType<typeof getRiderT>;
  podFile: File | null;
  onPickPod: (f: File | null) => void;
}) {
  return (
    <div className="rounded-2xl bg-stone-50 dark:bg-stone-800 p-3 mb-3">
      <p className="text-sm font-semibold mb-1">{rt.podTitle}</p>
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">{rt.podHint}</p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onPickPod(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:min-h-[40px] file:px-4 file:rounded-xl file:border-0 file:bg-amber-500 file:text-white file:font-semibold"
      />
      {podFile && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Camera className="w-3.5 h-3.5" /> {podFile.name}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-stone-500 dark:text-stone-400 shrink-0">{label}</dt>
      <dd className="font-medium break-words min-w-0">{value}</dd>
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: 'warn' | 'error' | 'success'; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = {
    warn: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300',
    error: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300',
    success: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300',
  }[tone];

  return (
    <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm mb-3 ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function StatusScreen({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-4">{icon}</div>
      <h1 className="text-lg font-bold mb-2">{title}</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs">{text}</p>
      {children}
    </main>
  );
}
