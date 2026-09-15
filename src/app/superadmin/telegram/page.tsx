import { listTelegramIdentitiesAction } from '@/app/actions/telegram-admin';
import { TelegramAdminClient } from './TelegramAdminClient';
import { TelegramLinkCard } from '@/components/telegram/TelegramLinkCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Telegram Management — RAN-R-HAN Superadmin',
};

export default async function TelegramAdminPage() {
  const result = await listTelegramIdentitiesAction();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900">Telegram Management</h1>
        <p className="text-xs leading-relaxed text-slate-600">
          บัญชี Telegram ที่ยืนยันตัวตนแล้ว ผูกกับ user และสิทธิ์จริงในระบบ
          ทดสอบหรือยกเลิกได้ทีละบัญชี ไม่ต้องกรอก chat id เอง
        </p>
      </header>

      <TelegramLinkCard />

      <TelegramAdminClient
        initialRows={result.rows ?? []}
        initialError={result.success ? null : result.error ?? 'โหลดรายการไม่สำเร็จ'}
      />
    </div>
  );
}
