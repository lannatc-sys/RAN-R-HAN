import { getAllStoresAction } from '@/app/actions/superadmin';
import { CreditCard, Check, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export default async function SuperadminPlansPage() {
  const { stores = [] } = await getAllStoresAction();

  const planStats = {
    basic: stores.filter((s) => s.plan === 'basic').length,
    standard: stores.filter((s) => s.plan === 'standard').length,
    pro: stores.filter((s) => s.plan === 'pro').length,
    enterprise: stores.filter((s) => s.plan === 'enterprise').length,
  };

  const plans = [
    {
      id: 'basic',
      name: 'Basic (ทดลองใช้)',
      price: 'ฟรี',
      period: 'จำกัด 50 บิล/เดือน',
      count: planStats.basic,
      color: 'border-slate-200 bg-white',
      badge: 'bg-slate-100 text-slate-700',
      features: [
        'สั่งอาหารออนไลน์ Pick-up',
        'หน้าจอ KDS รับออเดอร์',
        'PromptPay Dynamic QR',
        'ตรวจสลิปผ่าน SlipOK (BYOK)',
        'จำกัดไม่เกิน 50 ออเดอร์/เดือน',
      ],
    },
    {
      id: 'standard',
      name: 'Standard (ร้านขนาดกลาง)',
      price: '590',
      period: 'บาท / เดือน',
      count: planStats.standard,
      color: 'border-amber-400 bg-amber-50/30',
      badge: 'bg-amber-100 text-amber-800',
      popular: true,
      features: [
        'ทุกฟีเจอร์ของ Basic',
        'ไม่จำกัดจำนวนออเดอร์',
        'Web Push Notification ทุกอุปกรณ์',
        'จัดการรูปภาพเมนู 50 รายการ',
        'สถิติยอดขายรายวัน',
      ],
    },
    {
      id: 'pro',
      name: 'Pro (ร้านอาหารมืออาชีพ)',
      price: '1,290',
      period: 'บาท / เดือน',
      count: planStats.pro,
      color: 'border-slate-200 bg-white',
      badge: 'bg-emerald-100 text-emerald-800',
      features: [
        'ทุกฟีเจอร์ของ Standard',
        'ระบบสั่งอาหารที่โต๊ะ (Dine-in QR)',
        'KDS หลายเครื่องพร้อมกัน',
        'รายงานยอดขายเชิงลึกและ Export CSV',
        'Support พิเศษแบบ Priority',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise (หลายสาขา)',
      price: 'กำหนดเอง',
      period: 'ติดต่อฝ่ายขาย',
      count: planStats.enterprise,
      color: 'border-slate-200 bg-white',
      badge: 'bg-purple-100 text-purple-800',
      features: [
        'ทุกฟีเจอร์ของ Pro',
        'ระบบ Multi-branch หลายสาขา',
        'Custom Domain ของร้านค้า',
        'API เชื่อมต่อระบบบัญชีภายนอก',
        'SLA รับประกันระบบ 99.9%',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          แพ็กเกจและการเก็บค่าบริการ (SaaS Pricing & Plans)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          กำหนดระดับแพ็กเกจบริการและตรวจสอบจำนวนร้านค้าในแต่ละระดับ
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`rounded-3xl border p-6 shadow-xs relative flex flex-col justify-between ${p.color}`}
          >
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>ยอดนิยม</span>
              </span>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${p.badge}`}>
                  {p.name}
                </span>
                <span className="text-xs font-bold text-slate-500">{p.count} ร้าน</span>
              </div>

              <div>
                <div className="text-2xl font-black text-slate-950">{p.price}</div>
                <div className="text-[11px] text-slate-500">{p.period}</div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                {p.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <div className="w-full py-2 rounded-xl bg-slate-100 text-center text-slate-700 text-xs font-bold">
                ใช้งานอยู่ {p.count} ร้านค้า
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
