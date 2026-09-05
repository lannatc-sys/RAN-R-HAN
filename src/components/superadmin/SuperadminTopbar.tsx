'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStoreFromSuperadminAction } from '@/app/actions/superadmin';
import {
  PlusCircle,
  ShieldCheck,
  Store,
  X,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface SuperadminTopbarProps {
  userEmail?: string;
  fullName?: string;
}

export function SuperadminTopbar({ userEmail, fullName }: SuperadminTopbarProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('standard');
  const [promptpayId, setPromptpayId] = useState('');
  const [promptpayName, setPromptpayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const res = await createStoreFromSuperadminAction({
      name,
      phone,
      plan,
      promptpay_id: promptpayId || phone,
      promptpay_name: promptpayName || name,
    });

    setIsSubmitting(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsCreateOpen(false);
        setName('');
        setPhone('');
        setPromptpayId('');
        setPromptpayName('');
        router.refresh();
      }, 1500);
    } else {
      setError(res.error || 'ไม่สามารถสร้างร้านค้าได้');
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
        {/* Left: Role Badge & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>SUPERADMIN MODE</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">|</span>
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
            ศูนย์ควบคุมระบบ SaaS กลาง
          </span>
        </div>

        {/* Right: Create Store Button & User */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>สร้างร้านค้าใหม่</span>
          </button>

          <div className="h-4 w-px bg-slate-200"></div>

          <div className="flex items-center gap-2 text-right">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-xs">
              {(fullName || userEmail || 'SA')[0].toUpperCase()}
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-xs font-bold text-slate-900">{fullName || 'ผู้ดูแลระบบ'}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                {userEmail || 'superadmin@kin-d.pos'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal: Create New Store */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">สร้างร้านอาหารใหม่</h3>
                  <p className="text-[11px] text-slate-500">เปิดระบบให้ลูกค้ารายใหม่ใช้งาน SaaS ทันที</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>สร้างร้านอาหารสำเร็จเรียบร้อยแล้ว! 🎉</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateStore} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อร้านอาหาร <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ส้มตำยายเพ็ญ สาขา 1"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="เช่น 0812345678"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    แพ็กเกจ (Plan)
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="basic">Basic (ทดลองใช้)</option>
                    <option value="standard">Standard (ร้านทั่วไป)</option>
                    <option value="pro">Pro (ไม่จำกัดบิล)</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเลขพร้อมเพย์ (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={promptpayId}
                  onChange={(e) => setPromptpayId(e.target.value)}
                  placeholder="เว้นว่างไว้จะใช้เบอร์โทรของร้าน"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>เปิดร้านใหม่</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
