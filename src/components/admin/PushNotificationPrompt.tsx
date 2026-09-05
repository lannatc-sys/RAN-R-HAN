'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing, AlertTriangle, Check, Loader2 } from 'lucide-react';

interface PushNotificationPromptProps {
  shopId: string;
}

export function PushNotificationPrompt({ shopId }: PushNotificationPromptProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. ตรวจสอบสภาพแวดล้อม iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // 2. ตรวจสอบว่าเปิดในโหมด Add to Home Screen (Standalone) หรือไม่
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneMode);

    // 3. ตรวจสอบการรองรับ Service Worker และ Push Manager
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);

      // ตรวจสอบ permission และ subscription ปัจจุบัน
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setIsSubscribed(true);
          }
        });
      });
    }
  }, []);

  const handleSubscribe = async () => {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setStatusMessage('ยังไม่ได้กำหนด NEXT_PUBLIC_VAPID_PUBLIC_KEY ในระบบ');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(null);

      // ขอ Permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatusMessage('คุณไม่อนุญาตให้ส่งการแจ้งเตือน กรุณาเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์');
        setIsLoading(false);
        return;
      }

      // ลงทะเบียน Service Worker ถ้ายังไม่มี
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe กับ Push Service
      const convertedVapidKey = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // ส่ง Subscription ไปบันทึกที่เซิร์ฟเวอร์
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          subscription: subscription.toJSON(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save subscription');
      }

      setIsSubscribed(true);
      setStatusMessage('เปิดการแจ้งเตือนออเดอร์ใหม่สำเร็จแล้ว!');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || 'เกิดข้อผิดพลาดในการเปิดการแจ้งเตือน');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper แปลง VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // กรณีเป็น iOS แต่ยังไม่ได้ Add to Home Screen (Web Push บน iOS 16.4+ บังคับต้องเปิดจาก Home Screen)
  if (isIOS && !isStandalone) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">แนะนำสำหรับ iPhone / iPad:</div>
          <div>
            เพื่อให้มีเสียงเตือนออเดอร์ใหม่ กรุณากดปุ่ม <b>แชร์ (Share)</b> แล้วเลือก <b>"เพิ่มลงหน้าจอโฮม" (Add to Home Screen)</b> ก่อนใช้งาน
          </div>
        </div>
      </div>
    );
  }

  if (!isSupported) return null;

  return (
    <div className="flex items-center gap-2">
      {isSubscribed ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>เตือนออเดอร์เปิดอยู่</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BellRing className="w-3.5 h-3.5" />
          )}
          <span>เปิดเสียงเตือนออเดอร์ใหม่</span>
        </button>
      )}

      {statusMessage && (
        <span className="text-[11px] text-stone-500 hidden sm:inline">{statusMessage}</span>
      )}
    </div>
  );
}
