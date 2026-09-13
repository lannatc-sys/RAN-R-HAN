import { ServiceAreaMapClient } from './ServiceAreaMapClient';

// The superadmin layout runs checkIsSuperadmin() on every request, so this page
// is protected by that check rather than by its address being hard to guess.
export const dynamic = 'force-dynamic';

export default function ServiceAreaMapPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-white">แก้ไขพื้นที่ให้บริการ (Service Area Map)</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          วาดขอบเขตพื้นที่ลูกค้าและพื้นที่ไรเดอร์ — รอบนี้เป็นการทดลองหน้าตาและการวาดเท่านั้น
          ยังไม่บันทึกลงฐานข้อมูล และยังไม่มีผลกับร้านใดในระบบ
        </p>
      </header>
      <ServiceAreaMapClient />
    </div>
  );
}
