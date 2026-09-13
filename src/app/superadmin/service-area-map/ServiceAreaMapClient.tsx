'use client';

import dynamic from 'next/dynamic';
import { ServiceAreaMapEditorShell } from '@/components/service-area-map';

// Leaflet touches window on import, so it must stay out of the server render.
const ServiceAreaLeafletCanvas = dynamic(
  () => import('@/components/superadmin/ServiceAreaLeafletCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[280px] sm:min-h-[420px] aspect-[4/3] sm:aspect-[16/10] rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 text-sm">
        กำลังโหลดแผนที่แม่ฮ่องสอน...
      </div>
    ),
  }
);

export function ServiceAreaMapClient() {
  return (
    <ServiceAreaMapEditorShell
      renderCanvas={(props) => <ServiceAreaLeafletCanvas {...props} />}
    />
  );
}
