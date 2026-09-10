'use client';

import { useState, useTransition } from 'react';
import { submitDataSubjectRequestAction } from '@/app/actions/legal';
import { DataSubjectRequestType } from '@/lib/types';
import { Shield, Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface DataSubjectRequestFormProps {
  shopId?: string | null;
  shopName?: string;
}

export function DataSubjectRequestForm({ shopId, shopName }: DataSubjectRequestFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState<DataSubjectRequestType>('access');
  const [details, setDetails] = useState('');

  const [successInfo, setSuccessInfo] = useState<{ id: string; dueDate: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await submitDataSubjectRequestAction({
        shop_id: shopId || undefined,
        requester_name: name.trim(),
        requester_phone: phone.trim(),
        requester_email: email.trim() || undefined,
        request_type: requestType,
        details: details.trim() || undefined,
      });

      if (res.success && res.requestId) {
        setSuccessInfo({ id: res.requestId, dueDate: res.dueDate || '' });
        setName('');
        setPhone('');
        setEmail('');
        setDetails('');
      } else {
        setErrorMsg(res.error || 'ไม่สามารถส่งคำร้องได้ กรุณาลองใหม่อีกครั้ง');
      }
    });
  };

  return (
    <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 space-y-4">
      <div className="flex items-center gap-2 text-stone-900 dark:text-white font-bold text-base">
        <Shield className="w-5 h-5 text-emerald-500" />
        <h3>แบบฟอร์มยื่นคำขอใช้สิทธิของเจ้าของข้อมูล (PDPA Data Subject Request)</h3>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        ท่านสามารถยื่นคำขอตามสิทธิ 8 ประการ (เช่น ขอตรวจสอบ, ขอสำเนา, ขอลบ หรือขอแก้ไขข้อมูล) {shopName ? `ต่อร้าน ${shopName}` : 'ต่อแพลตฟอร์ม RAN-R-HAN'} ทีมงานจะดำเนินการให้แล้วเสร็จภายใน 30 วันตามกฎหมาย
      </p>

      {successInfo ? (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>ได้รับคำร้องขอใช้สิทธิเรียบร้อยแล้ว</span>
          </div>
          <p className="text-xs">
            รหัสคำร้อง: <strong className="font-mono">{successInfo.id}</strong>
          </p>
          <p className="text-xs">
            กำหนดการดำเนินการให้แล้วเสร็จภายใน:{' '}
            <strong>{new Date(successInfo.dueDate).toLocaleDateString('th-TH')}</strong> (ไม่เกิน 30 วัน)
          </p>
          <button
            type="button"
            onClick={() => setSuccessInfo(null)}
            className="text-xs underline text-emerald-700 dark:text-emerald-400 mt-2 block"
          >
            ยื่นคำร้องอื่นเพิ่มเติม
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                ชื่อ-นามสกุล ผู้ขอใช้สิทธิ *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น นายสมชาย ใจดี"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                เบอร์โทรศัพท์ที่เคยใช้สั่งซื้อ *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0812345678"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                อีเมลติดต่อกลับ (ไม่บังคับ)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                ประเภทสิทธิที่ต้องการใช้ *
              </label>
              <select
                value={requestType}
                onChange={e => setRequestType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
              >
                <option value="access">ขอเข้าถึงข้อมูลส่วนบุคคล (Right of Access)</option>
                <option value="copy">ขอรับสำเนาข้อมูลส่วนบุคคล (Right to Copy)</option>
                <option value="correct">ขอแก้ไขข้อมูลให้ถูกต้อง (Right to Rectification)</option>
                <option value="delete">ขอลบหรือทำลายข้อมูล (Right to Erasure)</option>
                <option value="suspend">ขอระงับการใช้ข้อมูลชั่วคราว (Right to Restriction)</option>
                <option value="withdraw">ขอถอนความยินยอม (Right to Withdraw Consent)</option>
                <option value="object">ขอคัดค้านการประมวลผลข้อมูล (Right to Object)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              รายละเอียดเพิ่มเติม / หมายเลขออเดอร์ที่เกี่ยวข้อง
            </label>
            <textarea
              rows={2}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="ระบุเหตุผลหรือรายละเอียดที่ต้องการให้ดำเนินการ..."
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isPending ? 'กำลังส่งคำร้อง...' : 'ส่งคำร้องขอใช้สิทธิ (Submit)'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
