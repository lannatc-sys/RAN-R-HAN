import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, Database, Trash2, Clock } from 'lucide-react';
import { DataSubjectRequestForm } from '@/components/legal/DataSubjectRequestForm';

export const metadata = {
  title: 'นโยบายความเป็นส่วนตัว (Privacy Policy) | RAN-R-HAN',
  description: 'นโยบายการคุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)',
};

export default function PlatformPrivacyPage() {
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
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                นโยบายความเป็นส่วนตัว (Privacy Policy)
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                การคุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-800">
            <span>มีผลบังคับใช้: 10 กันยายน 2569</span>
            <span>เวอร์ชัน: 2026.1 (PDPA Ready)</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              1. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม
            </h2>
            <p>
              เพื่อให้บริการสั่งซื้อและจัดส่งอาหาร เราเก็บรวบรวมข้อมูลเท่าที่จำเป็นอย่างเคร่งครัด ได้แก่:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>ข้อมูลระบุตัวตนและการติดต่อ:</strong> ชื่อ-นามสกุล, หมายเลขโทรศัพท์</li>
              <li><strong>ข้อมูลการจัดส่ง:</strong> ที่อยู่จัดส่ง, จุดรับสินค้าที่เลือก, พิกัด GPS (เฉพาะกรณีท่านกดยินยอมเพื่อนำทาง)</li>
              <li><strong>ข้อมูลการทำธุรกรรม:</strong> รายการอาหารที่สั่ง, ยอดเงิน, ประวัติการชำระเงิน, สลิปโอนเงิน (สำหรับตรวจสอบความถูกต้อง)</li>
              <li><strong>ข้อมูลเทคนิค:</strong> บันทึกเวลาที่ให้ความยินยอม (Consent Timestamp), หมายเลขคำสั่งซื้อ</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500" />
              2. วัตถุประสงค์และฐานทางกฎหมายในการประมวลผลข้อมูล
            </h2>
            <p>เราประมวลผลข้อมูลของท่านตามฐานกฎหมายดังต่อไปนี้:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>ฐานสัญญา (Contract):</strong> เพื่อเตรียมอาหาร ดำเนินการชำระเงิน และจัดส่งให้ถึงมือท่าน</li>
              <li><strong>ฐานประโยชน์ชอบด้วยกฎหมาย (Legitimate Interest):</strong> เพื่อป้องกันการฉ้อโกง ตรวจสอบสลิปซ้ำ และรักษาความปลอดภัยระบบ</li>
              <li><strong>ฐานความยินยอม (Consent):</strong> สำหรับการเข้าถึงตำแหน่งพิกัด GPS เพื่อระบุจุดรับส่งสินค้า</li>
              <li><strong>ฐานหน้าที่ตามกฎหมาย (Legal Obligation):</strong> เพื่อเก็บบันทึกหลักฐานทางการเงินและบัญชีตามประมวลรัษฎากร</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              3. ระยะเวลาในการเก็บรักษาข้อมูล (Data Retention Policy)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-2.5">ประเภทข้อมูล</th>
                    <th className="p-2.5">ระยะเวลาจัดเก็บ</th>
                    <th className="p-2.5">การดำเนินการเมื่อครบกำหนด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  <tr>
                    <td className="p-2.5 font-medium">ออเดอร์ที่ยกเลิก / ชำระเงินไม่สำเร็จ</td>
                    <td className="p-2.5">ไม่เกิน 90 วัน</td>
                    <td className="p-2.5 text-stone-500">ลบหรือทำลายอัตโนมัติ</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">ข้อความดิบจากคอมเมนต์ Facebook</td>
                    <td className="p-2.5">ไม่เกิน 90 วันหลังจบรอบส่ง</td>
                    <td className="p-2.5 text-stone-500">ล้างข้อความออกจากระบบ</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">บันทึกธุรกรรมที่ชำระเงินสำเร็จ (ใบเสร็จ)</td>
                    <td className="p-2.5">5 - 7 ปี ตามกฎหมายภาษี</td>
                    <td className="p-2.5 text-stone-500">จำกัดการเข้าถึงเฉพาะเจ้าของร้าน</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">หลักฐานความยินยอม (Consent Log)</td>
                    <td className="p-2.5">ตลอดระยะเวลาที่จัดเก็บคำสั่งซื้อ</td>
                    <td className="p-2.5 text-stone-500">ลบพร้อมข้อมูลคำสั่งซื้อ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-emerald-500" />
              4. สิทธิของท่านตามกฎหมาย PDPA (Data Subject Rights)
            </h2>
            <p>
              ท่านมีสิทธิตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล 8 ประการ ได้แก่ สิทธิขอเข้าถึงและรับสำเนา, สิทธิขอให้แก้ไขข้อมูล, สิทธิขอลบหรือทำลาย, สิทธิขอระงับการใช้, สิทธิขอโอนย้ายข้อมูล, สิทธิถอนความยินยอม และสิทธิคัดค้านการประมวลผล
            </p>
          </section>

          {/* DSR Form Embed */}
          <section className="pt-2">
            <DataSubjectRequestForm />
          </section>
        </div>
      </div>
    </div>
  );
}
