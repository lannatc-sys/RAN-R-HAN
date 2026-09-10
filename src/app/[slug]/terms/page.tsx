import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft, FileText, Store, Shield, Scale, Clock } from 'lucide-react';

interface StoreTermsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StoreTermsPage({ params }: StoreTermsPageProps) {
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
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                ข้อกำหนดและเงื่อนไขการใช้บริการ
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5 text-amber-500" />
                ร้าน: <strong>{shop.name}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-800">
            <span>มีผลบังคับใช้: 10 กันยายน 2569</span>
            <span>แพลตฟอร์ม: RAN-R-HAN</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500" />
              1. การสั่งซื้อและข้อตกลงการบริการ
            </h2>
            <p>
              เมื่อท่านสั่งซื้ออาหารจากร้าน <strong>{shop.name}</strong> ผ่านระบบออนไลน์ ถือว่าท่านตกลงผูกพันตามข้อกำหนดนี้ โดยร้านค้าจะจัดเตรียมอาหารตามรายการที่ยืนยันในคำสั่งซื้ออย่างถูกต้อง ถูกสุขอนามัย และตามมาตรฐานความปลอดภัยทางอาหาร
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              2. ช่องทางให้บริการของร้าน
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              {shop.allow_takeaway !== false && (
                <li><strong>รับที่ร้าน (Takeaway):</strong> นัดรับอาหารตามเวลาที่กำหนด ณ ที่ตั้งร้าน</li>
              )}
              {shop.allow_dine_in !== false && (
                <li><strong>ทานที่ร้าน (Dine-in):</strong> สั่งอาหารและรับประทานภายในร้าน</li>
              )}
              {(shop.allow_delivery || shop.is_delivery_enabled) && (
                <li><strong>จัดส่ง (Delivery):</strong> จัดส่งตามจุดรับหรือพิกัดในเขตพื้นที่ให้บริการ</li>
              )}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              3. การชำระเงินและเงื่อนไขการคืนเงิน
            </h2>
            <p>
              การชำระเงินผ่านพร้อมเพย์จะเข้าสู่บัญชี <strong>{shop.promptpay_name || shop.name}</strong> โดยตรง เมื่อร้านค้าเริ่มปรุงอาหารแล้ว (สถานะ Cooking) จะไม่สามารถยกเลิกออเดอร์ได้ หากมีเหตุขัดข้องประการใด กรุณาติดต่อทางร้านโดยตรง
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              4. ข้อมูลส่วนบุคคลและการคุ้มครอง PDPA
            </h2>
            <p>
              ร้าน <strong>{shop.name}</strong> ให้ความสำคัญกับการคุ้มครองข้อมูลของท่าน ท่านสามารถดูรายละเอียดนโยบายความเป็นส่วนตัวของร้านได้ที่{' '}
              <Link href={`/${slug}/privacy`} className="text-emerald-600 hover:underline font-semibold">
                นโยบายความเป็นส่วนตัวของร้าน {shop.name}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
