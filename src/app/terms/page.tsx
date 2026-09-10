import Link from 'next/link';
import { ArrowLeft, FileText, Shield, Scale, Clock, AlertCircle } from 'lucide-react';

export const metadata = {
  title: 'ข้อกำหนดและเงื่อนไขการใช้บริการ | RAN-R-HAN',
  description: 'ข้อกำหนดและเงื่อนไขการใช้บริการระบบสั่งอาหารออนไลน์ RAN-R-HAN (รับอาหาร)',
};

export default function PlatformTermsPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับสู่หน้าหลัก
        </Link>

        {/* Card Header */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                ข้อกำหนดและเงื่อนไขการใช้บริการ
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Terms of Service (ToS) — แพลตฟอร์ม RAN-R-HAN (รับอาหาร)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-800">
            <span>มีผลบังคับใช้: 10 กันยายน 2569</span>
            <span>เวอร์ชัน: 2026.1</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500" />
              1. การยอมรับข้อกำหนด
            </h2>
            <p>
              การเข้าถึงหรือการทำรายการสั่งซื้ออาหารผ่านแพลตฟอร์ม RAN-R-HAN ไม่ว่าจะเป็นการสั่งล่วงหน้าเพื่อรับที่ร้าน (Takeaway), รับประทานที่ร้าน (Dine-in), จัดส่งตามรอบ (Delivery) หรือการสั่งผ่านระบบพรีออเดอร์ ถือว่าท่านได้อ่าน ทำความเข้าใจ และตกลงยินยอมผูกพันตามข้อกำหนดและเงื่อนไขฉบับนี้ทุกประการ
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              2. ช่องทางและกระบวนการสั่งซื้อ
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>รับที่ร้าน (Takeaway):</strong> ท่านสามารถสั่งอาหารล่วงหน้าและระบุเวลานัดรับตามที่ร้านค้ากำหนด</li>
              <li><strong>ทานที่ร้าน (Dine-in):</strong> ท่านสามารถสแกนสั่งจากโต๊ะและระบุหมายเลขโต๊ะในระบบ</li>
              <li><strong>จัดส่ง (Delivery):</strong> ร้านค้าจะจัดส่งตามพิกัดหรือที่อยู่ที่ท่านระบุในพื้นที่ให้บริการ</li>
              <li><strong>พรีออเดอร์ (Facebook Comment):</strong> การสั่งจองสินค้าผ่านการแสดงความคิดเห็นในรอบเวลาที่ร้านค้าเปิดรับ</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              3. ราคา การชำระเงิน และการตรวจสอบสลิป
            </h2>
            <p>
              ราคาที่แสดงในขณะยืนยันคำสั่งซื้อคือราคาที่มีผลบังคับใช้จริง การชำระเงินรองรับทั้ง <strong>เงินสด (Cash/COD)</strong> และ <strong>พร้อมเพย์ (PromptPay QR)</strong> กรณีชำระผ่าน PromptPay ระบบจะตรวจสอบยอดเงินและบัญชีผู้รับเงินโดยอัตโนมัติผ่านผู้ให้บริการตรวจสอบสลิปมาตรฐาน
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
              * คำเตือน: โปรดตรวจสอบยอดเงินและชื่อบัญชีปลายทางก่อนโอนทุกครั้ง ระบบขอสงวนสิทธิ์ในการรับผิดชอบกรณีท่านโอนเงินไปยังบัญชีอื่นอันเกิดจากความประมาทเลินเล่อของท่านเอง
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              4. เงื่อนไขการยกเลิกและการคืนเงิน
            </h2>
            <p>
              คำสั่งซื้อสามารถยกเลิกได้เฉพาะเมื่ออยู่ในสถานะ <strong>"รอดำเนินการ (Pending)"</strong> หรือ <strong>"ยืนยันแล้ว (Confirmed)"</strong> เท่านั้น หากร้านค้าเริ่มปรุงอาหารแล้ว (สถานะ <strong>Cooking</strong> เป็นต้นไป) จะไม่สามารถยกเลิกได้เพื่อป้องกันความเสียหายต่อวัตถุดิบ
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              5. ข้อมูลส่วนบุคคลและความเป็นส่วนตัว
            </h2>
            <p>
              ข้อมูลของท่านจะได้รับการคุ้มครองตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ท่านสามารถศึกษารายละเอียดสิทธิและการจัดเก็บข้อมูลได้ที่{' '}
              <Link href="/privacy" className="text-emerald-600 hover:underline font-semibold">
                นโยบายความเป็นส่วนตัว (Privacy Policy)
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
