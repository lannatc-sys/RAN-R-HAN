import { getRiderLiveMonitorSnapshotAction } from '@/app/actions/superadmin';
import { RiderLiveMonitorClient } from './RiderLiveMonitorClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rider Live Monitor — RAN-R-HAN Superadmin',
};

export default async function RiderLiveMonitorPage() {
  const result = await getRiderLiveMonitorSnapshotAction();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900">Rider Live Monitor</h1>
        <p className="text-xs leading-relaxed text-slate-600">
          ติดตาม session, ความสดของ GPS, สถานะในเขต และงานปัจจุบันของไรเดอร์ทุกคน
          ข้อมูลหน้านี้อ่านอย่างเดียวและรีเฟรชอัตโนมัติทุก 5 วินาทีเมื่อเปิดดูอยู่
        </p>
      </header>

      <RiderLiveMonitorClient
        initialRows={result.riders ?? []}
        initialError={result.success ? null : result.error ?? 'โหลดสถานะไรเดอร์ไม่สำเร็จ'}
        initialSnapshotAt={result.snapshotAt ?? null}
      />
    </div>
  );
}
