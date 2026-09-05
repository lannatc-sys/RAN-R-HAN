import Link from 'next/link';
import { Utensils, Store, ArrowRight, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-amber-50/50 via-stone-50 to-amber-100/20">
      <div className="max-w-md w-full text-center space-y-8 bg-white p-8 rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-100/80">
        <div className="mx-auto w-16 h-16 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/30">
          <Utensils className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            รับอาหาร (Rab-R-HAN)
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            สั่งอาหารออนไลน์ล่วงหน้า รับสะดวกที่หน้าร้าน พร้อมระบบตรวจสอบสลิปอัตโนมัติ
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/krua-khun-yai"
            className="flex items-center justify-between w-full px-5 py-4 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-2xl shadow-md shadow-amber-600/20 transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <Store className="w-5 h-5 opacity-90" />
              <div>
                <div className="text-sm font-semibold">ร้านตัวอย่าง (ครัวคุณยาย)</div>
                <div className="text-xs text-amber-100">สั่งอาหารและรับที่ร้าน</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-between w-full px-5 py-4 bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-medium rounded-2xl transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <ShieldCheck className="w-5 h-5 text-stone-500" />
              <div>
                <div className="text-sm font-semibold">เข้าสู่ระบบหลังร้าน</div>
                <div className="text-xs text-stone-500">สำหรับเจ้าของร้านและพนักงาน (POS/KDS)</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="pt-4 border-t border-stone-100 text-xs text-stone-400">
          Rab-R-HAN Platform MVP • Multi-device & Zero-printer Ready
        </div>
      </div>
    </main>
  );
}
