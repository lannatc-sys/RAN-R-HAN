import { getShopsForAreaMapAction } from '@/app/actions/superadmin';
import { ServiceAreaMapClient } from './ServiceAreaMapClient';

// The superadmin layout runs checkIsSuperadmin() on every request, so this page
// is protected by that check rather than by its address being hard to guess.
export const dynamic = 'force-dynamic';

export default async function ServiceAreaMapPage() {
  const { shops, error } = await getShopsForAreaMapAction();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900">
          แก้ไขพื้นที่ให้บริการ (Service Area Map)
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          ปักหมุดร้าน วาดขอบเขตลูกค้าและไรเดอร์ แล้วบันทึกลงระบบจริง
          Polygon ที่บันทึกจะใช้แทนรัศมี fallback เมื่อเปิดการจำกัดพื้นที่ของร้าน
        </p>
      </header>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900">
          โหลดรายชื่อร้านไม่สำเร็จ: {error}
        </div>
      ) : (
        <ServiceAreaMapClient shops={shops ?? []} />
      )}
    </div>
  );
}
