'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { updateServiceAreaSettingsAction } from '@/app/actions/settings';
import type { Shop } from '@/lib/types';

interface ServiceAreaSettingsClientProps {
  shop: Shop;
}

/**
 * พื้นที่ให้บริการถูกย้ายไปอยู่กับ superadmin แล้ว หน้านี้จึงเหลือแสดงอย่างเดียว
 *
 * ด่านจริงอยู่ที่ฟังก์ชันในฐานข้อมูล (set_shop_service_area_settings ตรวจ
 * is_superadmin) หน้านี้เพียงไม่ยื่นปุ่มให้กดเปล่า ๆ
 *
 * คืนสิทธิ์ให้เจ้าของร้านได้โดยเปลี่ยนค่านี้เป็น true แล้วย้อน migration
 * 20260914000002 ด้วย ลำพังค่านี้อย่างเดียวจะได้ปุ่มที่กดแล้ว SHOP_ACCESS_DENIED
 */
const SHOP_CAN_EDIT_SERVICE_AREA = false;

export function ServiceAreaSettingsClient({ shop }: ServiceAreaSettingsClientProps) {
  const hasShopCoordinates =
    typeof shop.shop_lat === 'number' && typeof shop.shop_lng === 'number';
  const [enabled, setEnabled] = useState(shop.service_area_enabled ?? false);
  const [serviceRadius, setServiceRadius] = useState(shop.service_radius_m ?? 5000);
  const [riderRadius, setRiderRadius] = useState(shop.rider_work_radius_m ?? 10000);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setSaving(true);

    const result = await updateServiceAreaSettingsAction({
      shop_id: shop.id,
      service_area_enabled: enabled,
      service_radius_m: serviceRadius,
      rider_work_radius_m: riderRadius,
    });

    setSaving(false);
    if (!result.success) {
      setFeedback({ tone: 'error', text: result.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ' });
      return;
    }

    if (result.settings) {
      setEnabled(result.settings.service_area_enabled);
      setServiceRadius(Number(result.settings.service_radius_m));
      setRiderRadius(Number(result.settings.rider_work_radius_m));
    }
    setFeedback({ tone: 'success', text: 'บันทึกขอบเขตบริการเรียบร้อยแล้ว' });
  };

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <header>
        <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <MapPin aria-hidden="true" className="h-5 w-5" />
          <span className="text-sm font-bold">ขอบเขตการให้บริการและการทำงาน</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          ตั้งค่าพื้นที่ของร้าน
        </h1>
        <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-400">
          กำหนดรัศมีจากพิกัดร้านสำหรับลูกค้าจัดส่งและการเปิดงานของไรเดอร์
        </p>
      </header>

      {!hasShopCoordinates && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex gap-3">
            <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">ยังเปิดใช้งานไม่ได้</h2>
              <p className="mt-1 text-sm leading-6">
                ร้านของคุณยังไม่ได้ถูกปักหมุดบนแผนที่ ระบบจึงยังคำนวณขอบเขตไม่ได้
                กรุณาติดต่อผู้ดูแลแพลตฟอร์มเพื่อปักหมุดตำแหน่งร้าน
              </p>
            </div>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="space-y-5 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900">
          <legend className="px-2 text-base font-bold text-stone-900 dark:text-stone-100">
            การบังคับใช้ขอบเขต
          </legend>

          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/70">
            <span>
              <span className="block font-bold">เปิดใช้ขอบเขตพื้นที่</span>
              <span className="mt-1 block text-sm leading-5 text-stone-600 dark:text-stone-400">
                เมื่อเปิด ลูกค้านอกเขตจะสั่งจัดส่งไม่ได้ และไรเดอร์ต้องอยู่ในเขตทำงาน
              </span>
            </span>
            <input
              name="service_area_enabled"
              type="checkbox"
              checked={enabled}
              disabled={!SHOP_CAN_EDIT_SERVICE_AREA || !hasShopCoordinates}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-6 w-6 shrink-0 accent-amber-600"
            />
          </label>

          <div>
            <label htmlFor="service-radius" className="mb-1.5 block font-semibold">
              รัศมีให้บริการลูกค้า (เมตร)
            </label>
            <input
              id="service-radius"
              name="service_radius_m"
              disabled={!SHOP_CAN_EDIT_SERVICE_AREA}
              type="number"
              inputMode="numeric"
              min={1}
              max={200000}
              step={100}
              required
              value={serviceRadius}
              onChange={(event) => setServiceRadius(event.currentTarget.valueAsNumber)}
              aria-describedby="service-radius-help"
              className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-stone-700 dark:bg-stone-950"
            />
            <p id="service-radius-help" className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
              ปัจจุบันประมาณ {(serviceRadius / 1000).toLocaleString('th-TH')} กิโลเมตรจากร้าน
            </p>
          </div>

          <div>
            <label htmlFor="rider-radius" className="mb-1.5 block font-semibold">
              รัศมีพื้นที่ทำงานไรเดอร์ (เมตร)
            </label>
            <input
              id="rider-radius"
              name="rider_work_radius_m"
              disabled={!SHOP_CAN_EDIT_SERVICE_AREA}
              type="number"
              inputMode="numeric"
              min={1}
              max={200000}
              step={100}
              required
              value={riderRadius}
              onChange={(event) => setRiderRadius(event.currentTarget.valueAsNumber)}
              aria-describedby="rider-radius-help"
              className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-stone-700 dark:bg-stone-950"
            />
            <p id="rider-radius-help" className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
              ไรเดอร์ที่อยู่นอกเขตติดต่อกัน 15 นาทีจะถูกปิดการทำงานอัตโนมัติ
            </p>
          </div>

          <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600 dark:bg-stone-800/70 dark:text-stone-300">
            พิกัดศูนย์กลางร้าน: {hasShopCoordinates ? `${shop.shop_lat}, ${shop.shop_lng}` : 'ยังไม่ได้ตั้งค่า'}
          </div>
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="min-h-6">
          {feedback && (
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                feedback.tone === 'success'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {feedback.tone === 'success' && <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
              {feedback.text}
            </p>
          )}
        </div>

        {SHOP_CAN_EDIT_SERVICE_AREA && (
        <button
          type="submit"
          disabled={saving}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 font-bold text-white transition-colors hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {saving && <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />}
          {saving ? 'กำลังบันทึก…' : 'บันทึกขอบเขตบริการ'}
        </button>
        )}

        {!SHOP_CAN_EDIT_SERVICE_AREA && (
          <p className="text-sm leading-6 text-stone-600 dark:text-stone-400">
            ขอบเขตนี้กำหนดโดยผู้ดูแลแพลตฟอร์ม หน้านี้แสดงค่าที่ใช้อยู่จริงเพื่อให้ทราบว่า
            ร้านของคุณรับออเดอร์จัดส่งได้ถึงระยะใด หากต้องการเปลี่ยนกรุณาติดต่อผู้ดูแลระบบ
          </p>
        )}
      </form>
    </main>
  );
}
