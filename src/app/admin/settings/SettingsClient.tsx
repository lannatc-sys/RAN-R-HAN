'use client';

import { useState } from 'react';
import { Shop } from '@/lib/types';
import { updateShopSettingsAction, saveSlipCredentialsAction } from '@/app/actions/settings';
import { Store, CreditCard, ShieldCheck, Check, Key, Loader2, AlertCircle } from 'lucide-react';

interface SettingsClientProps {
  shop: Shop;
  hasSlipCredentials: boolean;
  slipProvider: string;
}

export function SettingsClient({
  shop,
  hasSlipCredentials,
  slipProvider,
}: SettingsClientProps) {
  // Shop Info State
  const [name, setName] = useState(shop.name);
  const [promptpayId, setPromptpayId] = useState(shop.promptpay_id || '');
  const [promptpayName, setPromptpayName] = useState(shop.promptpay_name || '');
  const [serviceCharge, setServiceCharge] = useState(shop.service_charge.toString());
  const [vatMode, setVatMode] = useState(shop.vat_mode);

  // SlipOK Creds State (Write-only)
  const [isHasCreds, setIsHasCreds] = useState(hasSlipCredentials);
  const [showKeyInput, setShowKeyInput] = useState(!hasSlipCredentials);
  const [apiKey, setApiKey] = useState('');
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsSuccess, setCredsSuccess] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);

  // General Shop Save State
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [shopSuccess, setShopSuccess] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);

  const handleSaveShopInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShop(true);
    setShopSuccess(false);
    setShopError(null);

    const res = await updateShopSettingsAction({
      shop_id: shop.id,
      name,
      promptpay_id: promptpayId,
      promptpay_name: promptpayName,
      service_charge: parseFloat(serviceCharge) || 0,
      vat_mode: vatMode,
    });

    setIsSavingShop(false);
    if (res.success) {
      setShopSuccess(true);
      setTimeout(() => setShopSuccess(false), 3000);
    } else {
      setShopError(res.error || 'ไม่สามารถบันทึกข้อมูลร้านค้าได้');
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSavingCreds(true);
    setCredsSuccess(false);
    setCredsError(null);

    const res = await saveSlipCredentialsAction({
      shop_id: shop.id,
      provider: 'slipok',
      api_key: apiKey.trim(),
    });

    setIsSavingCreds(false);
    if (res.success) {
      setIsHasCreds(true);
      setShowKeyInput(false);
      setApiKey('');
      setCredsSuccess(true);
      setTimeout(() => setCredsSuccess(false), 3000);
    } else {
      setCredsError(res.error || 'ไม่สามารถบันทึก API Key ได้');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">ตั้งค่าร้านค้าและการรับเงิน</h1>
        <p className="text-xs text-stone-500">จัดการข้อมูลบัญชีพร้อมเพย์ และ API Key ตรวจสอบสลิป</p>
      </div>

      {/* SlipOK Automated Slip Check API Key (Encrypted Write-Only) */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <span>ระบบตรวจสอบสลิปอัตโนมัติ (SlipOK / OkSlip)</span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed">
          นำ API Key จากบัญชี SlipOK ของร้านคุณมาใส่ที่นี่ ระบบจะทำการเข้ารหัสระดับสูง (AES-256-GCM)
          เพื่อความปลอดภัยของข้อมูล และไม่แสดงคีย์ย้อนหลัง
        </p>

        {credsSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>บันทึก API Key และเข้ารหัสความปลอดภัยเรียบร้อยแล้ว</span>
          </div>
        )}

        {credsError && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{credsError}</span>
          </div>
        )}

        {isHasCreds && !showKeyInput ? (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <div>
                <div className="text-xs font-bold text-emerald-900">ตั้งค่า API Key แล้ว ✅</div>
                <div className="text-[11px] text-emerald-700">
                  ระบบกำลังตรวจสลิปอัตโนมัติผ่านผู้ให้บริการ: {slipProvider}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyInput(true)}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold transition-colors"
            >
              เปลี่ยน API Key
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ระบุ SlipOK API Key (จะถูกบันทึกทับและเข้ารหัส)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="เช่น slp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2">
              {isHasCreds && (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingCreds}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
              >
                {isSavingCreds ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>บันทึก API Key</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Shop Info & PromptPay Config Form */}
      <form
        onSubmit={handleSaveShopInfo}
        className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
          <CreditCard className="w-5 h-5 text-amber-600" />
          <span>ข้อมูลร้านค้าและพร้อมเพย์</span>
        </div>

        {shopSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว</span>
          </div>
        )}

        {shopError && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{shopError}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">ชื่อร้านค้า</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                หมายเลขพร้อมเพย์ (เบอร์โทร 10 หลัก หรือ เลขบัตร ปชช. 13 หลัก)
              </label>
              <input
                type="text"
                value={promptpayId}
                onChange={(e) => setPromptpayId(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 0891234567"
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ชื่อบัญชีพร้อมเพย์ (แสดงให้ลูกค้าตรวจสอบ)
              </label>
              <input
                type="text"
                value={promptpayName}
                onChange={(e) => setPromptpayName(e.target.value)}
                placeholder="เช่น นางสมศรี มีโชค"
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ค่าบริการ Service Charge (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                รูปแบบภาษีมูลค่าเพิ่ม (VAT)
              </label>
              <select
                value={vatMode}
                onChange={(e) => setVatMode(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="none">ไม่คิด VAT</option>
                <option value="inclusive">รวมในราคาอาหารแล้ว (Inclusive 7%)</option>
                <option value="exclusive">คิดเพิ่มจากราคาอาหาร (Exclusive 7%)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSavingShop}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            {isSavingShop ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>บันทึกการตั้งค่าร้าน</span>
          </button>
        </div>
      </form>
    </div>
  );
}
