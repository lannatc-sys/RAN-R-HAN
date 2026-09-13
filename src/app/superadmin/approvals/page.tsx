import { listPromptpayRequestsAction } from '@/app/actions/superadmin';
import { ApprovalsClient } from './ApprovalsClient';

// หน้านี้อยู่ใต้ superadmin layout ซึ่งเรียก checkIsSuperadmin() ทุก request
// เลขพร้อมเพย์เต็มแสดงได้เฉพาะหน้านี้เท่านั้น (PDPA: อาจเป็นเลขบัตรประชาชน)
// ห้ามนำเลขเต็มไปแสดงที่อื่นหรือส่งออกนอกหน้านี้
export const dynamic = 'force-dynamic';

export default async function SuperadminApprovalsPage() {
  const { requests, error } = await listPromptpayRequestsAction();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900">คำขออนุมัติเปลี่ยนพร้อมเพย์</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          ตรวจคำขอจากร้านค้าแล้วอนุมัติหรือปฏิเสธ การอนุมัติจะเปลี่ยนเลขพร้อมเพย์ของร้านทันที
          เลขที่เห็นในหน้านี้เป็นข้อมูลส่วนบุคคล ห้ามคัดลอกออกนอกระบบ
        </p>
      </header>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900">
          โหลดรายการคำขอไม่สำเร็จ: {error}
        </div>
      ) : (
        <ApprovalsClient initialRequests={requests ?? []} />
      )}
    </div>
  );
}
