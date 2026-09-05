import { checkIsSuperadmin } from '@/app/actions/superadmin';
import { SuperadminSidebar } from '@/components/superadmin/SuperadminSidebar';
import { SuperadminTopbar } from '@/components/superadmin/SuperadminTopbar';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSuperadmin, user } = await checkIsSuperadmin();

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-950 max-w-md w-full p-8 rounded-3xl border border-slate-800 text-center space-y-5 text-slate-200 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">สงวนสิทธิ์เฉพาะ Superadmin</h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              หน้านี้เป็นศูนย์ควบคุมระบบแพลตฟอร์มกลางระดับ SaaS บัญชีของคุณ ({user?.email || 'Guest'}) ยังไม่มีสิทธิ์เข้าถึง
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/admin/orders"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับสู่ระบบจัดการหน้าร้าน (POS)</span>
            </Link>
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-medium hover:bg-slate-900 transition-colors"
            >
              เข้าสู่ระบบด้วยบัญชีอื่น
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100/70 text-slate-900 font-sans">
      <SuperadminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <SuperadminTopbar
          userEmail={user?.email}
          fullName={user?.user_metadata?.full_name}
        />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
