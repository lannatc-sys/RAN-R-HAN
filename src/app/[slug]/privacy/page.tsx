import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft, ShieldCheck, Store, Lock, Database, Clock, Trash2 } from 'lucide-react';
import { DataSubjectRequestForm } from '@/components/legal/DataSubjectRequestForm';

interface StorePrivacyPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StorePrivacyPage({ params }: StorePrivacyPageProps) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: shop } = await admin
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!shop) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับไปหน้าเมนูของร้าน {shop.name}
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
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5 text-emerald-500" />
                ผู้ควบคุมข้อมูล: <strong>{shop.name}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-800">
            <span>มีผลบังคับใช้: 10 กันยายน 2569</span>
            <span>สอดคล้องตาม: พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              1. ข้อมูลที่ร้าน {shop.name} เก็บรวบรวม
            </h2>
            <p>
              ทางร้านเก็บรวบรวมเฉพาะข้อมูลที่จำเป็นต่อการรับคำสั่งซื้อ การปรุงอาหาร และการจัดส่ง ได้แก่ ชื่อลูกค้า, เบอร์โทรศัพท์, ที่อยู่จัดส่ง หรือจุดนัดรับสินค้า โดยไม่มีการนำข้อมูลไปใช้ทำการตลาดที่ไม่พึงประสงค์ (No Spam/No Marketing SMS)
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500" />
              2. ความปลอดภัยและการจัดเก็บข้อมูล
            </h2>
            <p>
              ข้อมูลของท่านถูกจัดเก็บบนระบบคลาวด์มาตรฐานที่มีการเข้ารหัสและจำกัดสิทธิ์เฉพาะพนักงานของร้าน {shop.name} เท่านั้น ข้อมูลการชำระเงินและสลิปจะถูกเก็บรักษาไว้ตามระยะเวลาที่กฎหมายภาษีและบัญชีกำหนด (5-7 ปี) ส่วนข้อมูลออเดอร์ที่ถูกยกเลิกจะถูกลบทำลายภายใน 90 วัน
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-emerald-500" />
              3. การขอใช้สิทธิตามกฎหมาย PDPA
            </h2>
            <p>
              ท่านสามารถยื่นคำขอตรวจสอบ ขอแก้ไข หรือขอลบข้อมูลส่วนบุคคลของท่านได้โดยตรงผ่านแบบฟอร์มด้านล่างนี้ ทางร้านจะดำเนินการให้แล้วเสร็จภายใน 30 วัน
            </p>
          </section>

          {/* DSR Form Embed specifically for this shop */}
          <section className="pt-2">
            <DataSubjectRequestForm shopId={shop.id} shopName={shop.name} />
          </section>
        </div>
      </div>
    </div>
  );
}
