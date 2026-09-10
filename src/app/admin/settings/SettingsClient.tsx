'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shop } from '@/lib/types';
import {
  updateShopSettingsAction,
  saveSlipCredentialsAction,
  updateKdsPinAction,
  grantSupportAccessAction,
  revokeSupportAccessAction,
  updateFulfillmentChannelsAction,
} from '@/app/actions/settings';
import {
  updateShopTelegramSettingsAction,
  sendTelegramTestAction,
} from '@/app/actions/telegram';
import { getPlanEntitlements } from '@/lib/plans';
import { PinModal } from '@/components/admin/PinModal';
import {
  Store,
  CreditCard,
  ShieldCheck,
  Check,
  Key,
  Loader2,
  AlertCircle,
  TrendingUp,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Headphones,
  Clock,
  Utensils,
  ShoppingBag,
  Bike,
  Sparkles,
  Send,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

interface SettingsClientProps {
  shop: Shop;
  hasSlipCredentials: boolean;
  slipProvider: string;
  initialApiUrl?: string;
  todaySales?: number;
  todayOrderCount?: number;
  isPrivacyMode?: boolean;
}

export function SettingsClient({
  shop,
  hasSlipCredentials,
  slipProvider,
  initialApiUrl = '',
  todaySales = 0,
  todayOrderCount = 0,
  isPrivacyMode = false,
}: SettingsClientProps) {
  const router = useRouter();

  // Security PIN Gate State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Check sessionStorage on mount
  useEffect(() => {
    const key = `kds_pin_unlocked_${shop.id}`;
    const unlocked = sessionStorage.getItem(key) === 'true';
    setIsUnlocked(unlocked);
    setIsCheckingAuth(false);
  }, [shop.id]);

  // Shop Info State
  const [name, setName] = useState(shop.name);
  const [promptpayId, setPromptpayId] = useState(shop.promptpay_id || '');
  const [promptpayName, setPromptpayName] = useState(shop.promptpay_name || '');
  const [serviceCharge, setServiceCharge] = useState(shop.service_charge.toString());
  const [vatMode, setVatMode] = useState(shop.vat_mode);

  // SlipOK Creds State (SLIPOK API Endpoint & SLIPOK_API_KEY)
  const [isHasCreds, setIsHasCreds] = useState(hasSlipCredentials);
  const [showKeyInput, setShowKeyInput] = useState(!hasSlipCredentials);
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [apiKey, setApiKey] = useState('');
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsSuccess, setCredsSuccess] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);

  // General Shop Save State
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [shopSuccess, setShopSuccess] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);

  // PIN Settings State
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinCode, setShowPinCode] = useState(false);

  // Fulfillment Channels State (Governed by Plan)
  const planEntitlements = getPlanEntitlements(shop.plan);
  const [allowDineIn, setAllowDineIn] = useState<boolean>(shop.allow_dine_in !== false);
  const [allowTakeaway, setAllowTakeaway] = useState<boolean>(shop.allow_takeaway !== false);
  const [allowDelivery, setAllowDelivery] = useState<boolean>(
    shop.allow_delivery === true || shop.is_delivery_enabled === true
  );
  const [isSavingChannels, setIsSavingChannels] = useState(false);
  const [channelsSuccess, setChannelsSuccess] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingChannels(true);
    setChannelsError(null);
    setChannelsSuccess(false);

    const res = await updateFulfillmentChannelsAction({
      shop_id: shop.id,
      allow_dine_in: planEntitlements.canDineIn ? allowDineIn : false,
      allow_takeaway: allowTakeaway,
      allow_delivery:
        planEntitlements.canDelivery || Boolean(shop.is_delivery_enabled) ? allowDelivery : false,
    });

    setIsSavingChannels(false);
    if (!res.success) {
      setChannelsError(res.error || 'ไม่สามารถบันทึกช่องทางการสั่งอาหารได้');
      return;
    }
    setChannelsSuccess(true);
    setTimeout(() => setChannelsSuccess(false), 4000);
  };

  // Consent-based Support Access State
  const [supportExpiresAt, setSupportExpiresAt] = useState<string | null | undefined>(
    shop.support_access_expires_at
  );
  const [isUpdatingSupport, setIsUpdatingSupport] = useState(false);
  const [supportSuccessMsg, setSupportSuccessMsg] = useState<string | null>(null);
  const [supportErrorMsg, setSupportErrorMsg] = useState<string | null>(null);

  const isSupportActive = Boolean(
    supportExpiresAt && new Date(supportExpiresAt) > new Date()
  );
  const remainingHours = isSupportActive
    ? Math.max(
        1,
        Math.ceil(
          (new Date(supportExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60)
        )
      )
    : 0;

  const handleGrantAccess = async (hours: 24 | 48) => {
    setIsUpdatingSupport(true);
    setSupportSuccessMsg(null);
    setSupportErrorMsg(null);
    const res = await grantSupportAccessAction(shop.id, hours);
    setIsUpdatingSupport(false);
    if (res.success && res.expiresAt) {
      setSupportExpiresAt(res.expiresAt);
      setSupportSuccessMsg(`อนุญาตให้ทีมงานเข้าถึงข้อมูลชั่วคราว ${hours} ชั่วโมงเรียบร้อยแล้ว`);
      setTimeout(() => setSupportSuccessMsg(null), 4000);
    } else {
      setSupportErrorMsg(res.error || 'ไม่สามารถเปิดสิทธิ์ได้');
    }
  };

  const handleRevokeAccess = async () => {
    if (!window.confirm('คุณต้องการยกเลิกสิทธิ์การเข้าถึงข้อมูลยอดขายของทีมงานทันทีใช่หรือไม่?')) return;
    setIsUpdatingSupport(true);
    setSupportSuccessMsg(null);
    setSupportErrorMsg(null);
    const res = await revokeSupportAccessAction(shop.id);
    setIsUpdatingSupport(false);
    if (res.success) {
      setSupportExpiresAt(null);
      setSupportSuccessMsg('ยกเลิกสิทธิ์การเข้าถึงของทีมงานเรียบร้อยแล้ว (ยอดขายถูกเซ็นเซอร์ทันที)');
      setTimeout(() => setSupportSuccessMsg(null), 4000);
    } else {
      setSupportErrorMsg(res.error || 'ไม่สามารถยกเลิกสิทธิ์ได้');
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(`kds_pin_unlocked_${shop.id}`);
    setIsUnlocked(false);
  };

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
      api_url: apiUrl.trim() || undefined,
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

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setPinError('รหัส PIN ใหม่ต้องเป็นตัวเลข 4 หลักเท่านั้น');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinError('รหัส PIN ใหม่และการยืนยันไม่ตรงกัน');
      return;
    }

    setIsSavingPin(true);
    const res = await updateKdsPinAction({
      shop_id: shop.id,
      current_pin: currentPinInput || undefined,
      new_pin: newPinInput,
    });
    setIsSavingPin(false);

    if (res.success) {
      setPinSuccess(true);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      shop.kds_pin = newPinInput;
      setTimeout(() => setPinSuccess(false), 3000);
    } else {
      setPinError(res.error || 'ไม่สามารถเปลี่ยนรหัส PIN ได้');
    }
  };

  // Telegram Settings State
  const [telegramEnabled, setTelegramEnabled] = useState(shop.telegram_enabled !== false);
  const [isUpdatingTelegram, setIsUpdatingTelegram] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [testChatId, setTestChatId] = useState('');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleToggleTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingTelegram(true);
    setTelegramSuccess(null);
    setTelegramError(null);

    const res = await updateShopTelegramSettingsAction(shop.id, telegramEnabled);
    setIsUpdatingTelegram(false);

    if (res.success) {
      setTelegramSuccess('บันทึกการตั้งค่าการแจ้งเตือน Telegram เรียบร้อยแล้ว');
      setTimeout(() => setTelegramSuccess(null), 3000);
    } else {
      setTelegramError(res.error || 'ไม่สามารถบันทึกการตั้งค่าได้');
    }
  };

  const handleSendTestTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testChatId.trim()) return;

    setIsTestingTelegram(true);
    setTestResult(null);

    const res = await sendTelegramTestAction(testChatId.trim(), shop.name);
    setIsTestingTelegram(false);

    if (res.success) {
      setTestResult({ success: true, message: 'ส่งข้อความทดสอบสำเร็จ! ตรวจสอบแอป Telegram ได้เลยครับ ✅' });
    } else {
      setTestResult({ success: false, message: res.error || 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Chat ID และกด Start บอทก่อน' });
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* PIN Modal Gate if not unlocked */}
      <PinModal
        isOpen={!isUnlocked}
        onClose={() => router.push('/admin/orders')}
        expectedPin={shop.kds_pin || '0000'}
        title="รหัสผ่านผู้ดูแลร้าน (PIN 4 หลัก)"
        description="กรุณากรอกรหัส PIN เพื่อเข้าถึงหน้าตั้งค่าร้านและรายงานยอดขาย"
        onSuccess={() => {
          setIsUnlocked(true);
          sessionStorage.setItem(`kds_pin_unlocked_${shop.id}`, 'true');
        }}
      />

      {/* Header & Lock Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">ตั้งค่าร้านค้าและรายงานยอดขาย</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">จัดการข้อมูลร้าน บัญชีพร้อมเพย์ รหัส PIN และสถิติยอดขาย</p>
        </div>

        <button
          type="button"
          onClick={handleLock}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:white text-xs font-semibold bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 shadow-xs transition-colors cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
          <span>ล็อคหน้าจอนี้</span>
        </button>
      </div>

      {/* Today's Sales Report Card */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-3xl text-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <TrendingUp className="w-5 h-5 text-amber-100" />
            <span>สรุปยอดขายวันนี้</span>
          </div>
          <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
            {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {isPrivacyMode && (
          <div className="p-2.5 bg-black/25 rounded-xl text-amber-200 text-xs flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              โหมดความเป็นส่วนตัว Superadmin: ข้อมูลทางการเงินถูกเซ็นเซอร์เป็น *** ฿ เนื่องจากร้านค้ายังไม่ได้เปิดความยินยอม Support Access
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl">
            <div className="text-[11px] text-amber-100 font-medium">ยอดขายรวม</div>
            <div className="text-xl sm:text-2xl font-black mt-1">
              {isPrivacyMode ? '***' : todaySales.toLocaleString('th-TH')}{' '}
              <span className="text-xs font-normal">฿</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl">
            <div className="text-[11px] text-amber-100 font-medium">ออเดอร์ที่ยืนยันแล้ว</div>
            <div className="text-xl sm:text-2xl font-black mt-1">
              {todayOrderCount} <span className="text-xs font-normal">บิล</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl col-span-2 sm:col-span-1">
            <div className="text-[11px] text-amber-100 font-medium">ยอดเฉลี่ยต่อบิล</div>
            <div className="text-xl sm:text-2xl font-black mt-1">
              {isPrivacyMode
                ? '***'
                : todayOrderCount > 0
                ? Math.round(todaySales / todayOrderCount).toLocaleString('th-TH')
                : 0}{' '}
              <span className="text-xs font-normal">฿</span>
            </div>
          </div>
        </div>
      </div>

      {/* KDS PIN Management Card */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
            <Shield className="w-5 h-5 text-amber-600" />
            <span>รหัสความปลอดภัย PIN 4 หลัก (KDS & ตั้งค่าร้าน)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-md font-bold">
              {showPinCode ? `PIN: ${shop.kds_pin || '0000'}` : 'PIN: ••••'}
            </span>
            <button
              type="button"
              onClick={() => setShowPinCode(!showPinCode)}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 cursor-pointer"
            >
              {showPinCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          รหัส PIN 4 หลักใช้สำหรับยืนยันเมื่อพนักงานกดยกเลิกออเดอร์หน้าจอ KDS
          และใช้ล็อกการเข้าถึงหน้าตั้งค่าร้านค้าและรายงานยอดขายเพื่อป้องกันพนักงานทั่วไปเข้าถึง
          (ค่าเริ่มต้นคือ 0000)
        </p>

        {pinSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>เปลี่ยนรหัส PIN สำเร็จเรียบร้อยแล้ว</span>
          </div>
        )}

        {pinError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{pinError}</span>
          </div>
        )}

        <form onSubmit={handleSavePin} className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                รหัส PIN เดิม (4 หลัก)
              </label>
              <input
                type="password"
                maxLength={4}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="PIN เดิม (ถ้ามี)"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-widest text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                รหัส PIN ใหม่ (4 หลัก)
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 1234"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-widest text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                ยืนยันรหัส PIN ใหม่
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="กรอกอีกครั้ง"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-widest text-center"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSavingPin}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSavingPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>บันทึกรหัส PIN ใหม่</span>
            </button>
          </div>
        </form>
      </div>

      {/* SlipOK Automated Slip Check API (2 ค่า: SLIPOK API และ SLIPOK_API_KEY) */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <span>ระบบตรวจสอบสลิปอัตโนมัติ (SlipOK / OkSlip)</span>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          ระบุค่า <strong>SLIPOK API</strong> (URL Endpoint หรือสาขา) และ <strong>SLIPOK_API_KEY</strong> จากระบบ SlipOK เพื่อเปิดใช้งานการตรวจสลิปอัตโนมัติ โดยคีย์จะถูกเข้ารหัสระดับสูง (AES-256-GCM) เพื่อความปลอดภัยสูงสุด
        </p>

        {credsSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>บันทึกการตั้งค่า SlipOK และเข้ารหัสความปลอดภัยเรียบร้อยแล้ว</span>
          </div>
        )}

        {credsError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{credsError}</span>
          </div>
        )}

        {isHasCreds && !showKeyInput ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">ตั้งค่า SlipOK เรียบร้อยแล้ว ✅</div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  {apiUrl ? `SLIPOK API: ${apiUrl}` : 'ระบบกำลังตรวจสลิปอัตโนมัติผ่านผู้ให้บริการ SlipOK'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyInput(true)}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-stone-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              แก้ไขการตั้งค่า SlipOK
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveCredentials} className="space-y-3.5 pt-2">
            {/* 1. SLIPOK API (Endpoint URL) */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                SLIPOK API (URL Endpoint / สาขา)
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="เช่น https://api.slipok.com/api/line/apikey/xxx หรือ branch id"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 block">
                ระบุ URL สำหรับเรียกตรวจสลิปของ SlipOK
              </span>
            </div>

            {/* 2. SLIPOK_API_KEY */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                SLIPOK_API_KEY <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="เช่น slp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 block">
                API Key จะถูกเข้ารหัส AES-256-GCM ทันที และไม่แสดงคีย์ย้อนหลัง
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              {isHasCreds && (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(false)}
                  className="px-4 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingCreds}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingCreds ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>บันทึกการตั้งค่า SlipOK</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Telegram Customer Notification Bot Card */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <span>ระบบแจ้งเตือนลูกค้าผ่าน Telegram Bot</span>
          </div>
          <a
            href="https://t.me/ranrhan_bot"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <span>@ranrhan_bot</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          ส่งข้อความแจ้งเตือนสถานะอาหารอัตโนมัติ (รับออเดอร์, กำลังปรุง, พร้อมรับ) ตรงถึงลูกค้าผ่าน Telegram แบบ 1-on-1 โดยไม่มีค่าใช้จ่าย ลูกค้าสามารถกดปุ่มเชื่อมต่อได้จากหน้าสรุปคำสั่งซื้อ
        </p>

        {/* Bot Status Banner */}
        <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <span className="font-bold text-sky-900 dark:text-sky-200">บอทออนไลน์พร้อมทำงาน: </span>
              <span className="text-sky-700 dark:text-sky-400 font-mono text-[11px]">RAN-R-HAN (@ranrhan_bot)</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
            พร้อมใช้งาน
          </span>
        </div>

        {telegramSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{telegramSuccess}</span>
          </div>
        )}

        {telegramError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{telegramError}</span>
          </div>
        )}

        {/* Toggle Switch */}
        <form onSubmit={handleToggleTelegram} className="pt-1 space-y-4">
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-500" />
                <span>เปิดใช้งานการแจ้งเตือน Telegram สำหรับร้านนี้</span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                เมื่อเปิดใช้งาน ลูกค้าที่กดเชื่อมต่อจะได้รับแจ้งเตือนสถานะอาหารอัตโนมัติ
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-stone-600 peer-checked:bg-sky-600"></div>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingTelegram}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingTelegram ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>บันทึกการตั้งค่า Telegram</span>
            </button>
          </div>
        </form>

        {/* Test Telegram Message Box */}
        <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80">
          <div className="text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-stone-400" />
            <span>ทดสอบส่งข้อความ (Test Telegram Notification)</span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3">
            กรอก Telegram Chat ID ของคุณ เพื่อทดสอบว่าบอทสามารถส่งข้อความหาคุณได้ถูกต้อง (ทักบอท @ranrhan_bot แล้วกด Start ก่อนทดสอบ)
          </p>

          <form onSubmit={handleSendTestTelegram} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="ระบุ Chat ID เช่น 123456789"
              className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={isTestingTelegram || !testChatId.trim()}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isTestingTelegram ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-sky-500" />
              )}
              <span>ส่งข้อความทดสอบ</span>
            </button>
          </form>

          {testResult && (
            <div
              className={`mt-2.5 p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fulfillment Channels Card (Governed by Plan) */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
            <Utensils className="w-5 h-5 text-amber-600" />
            <span>ช่องทางการสั่งอาหาร (Fulfillment Channels)</span>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            แพ็กเกจ: {planEntitlements.planName}
          </span>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          กำหนดรูปแบบคำสั่งซื้อที่ร้านเปิดรับผ่านหน้าร้านออนไลน์ โดยตัวเลือกที่เปิดใช้งานจะขึ้นอยู่กับระดับแพ็กเกจ (Plan) ที่ร้านใช้งาน
        </p>

        {channelsSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>บันทึกการตั้งค่าช่องทางการสั่งอาหารเรียบร้อยแล้ว</span>
          </div>
        )}

        {channelsError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{channelsError}</span>
          </div>
        )}

        <form onSubmit={handleSaveChannels} className="space-y-3 pt-1">
          {/* 1. ทานที่ร้าน (Dine-in) */}
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">ทานที่ร้าน (Dine-in)</span>
                {!planEntitlements.canDineIn && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Standard / Pro
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                ลูกค้าสั่งผ่านมือถือและระบุเลขโต๊ะ เพื่อให้พนักงานไปเสิร์ฟที่โต๊ะอาหาร
              </p>
            </div>

            {planEntitlements.canDineIn ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDineIn}
                  onChange={(e) => setAllowDineIn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            ) : (
              <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">ไม่รองรับในแพ็กเกจนี้</span>
            )}
          </div>

          {/* 2. รับที่ร้าน (Takeaway / Pick-up) */}
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">รับหน้าร้าน / กลับบ้าน (Pick-up / Takeaway)</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  ทุกแพ็กเกจ
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                ลูกค้าสั่งล่วงหน้า เลือกเวลาประมาณการมารับ แล้วมารับอาหารที่หน้าร้าน
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allowTakeaway}
                onChange={(e) => setAllowTakeaway(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* 3. ร้านจัดส่งเอง (Store Delivery) */}
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Bike className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">ร้านจัดส่งเอง (Store Delivery)</span>
                {planEntitlements.canDelivery ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Pro / Premium
                  </span>
                ) : shop.is_delivery_enabled ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    สิทธิ์พิเศษ Superadmin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Pro / Premium
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                ลูกค้ากรอกชื่อ เบอร์โทร ที่อยู่จัดส่ง และส่งพิกัด GPS เพื่อให้พนักงานร้านไปส่ง
              </p>
            </div>

            {planEntitlements.canDelivery || shop.is_delivery_enabled ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDelivery}
                  onChange={(e) => setAllowDelivery(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            ) : (
              <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">ไม่รองรับในแพ็กเกจนี้</span>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingChannels}
              className="px-5 py-2.5 bg-stone-900 dark:bg-amber-600 hover:bg-stone-800 dark:hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSavingChannels ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>บันทึกการตั้งค่าช่องทาง</span>
            </button>
          </div>
        </form>
      </div>

      {/* Consent-based Support Access Card */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
            <Headphones className="w-5 h-5 text-amber-600" />
            <span>สิทธิ์การเข้าถึงเพื่อตรวจสอบปัญหา (Consent-based Support Access)</span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
              isSupportActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSupportActive ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
              }`}
            ></span>
            {isSupportActive ? 'อนุญาตแล้ว' : 'ปิดอยู่ (เป็นส่วนตัว)'}
          </span>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          หากร้านต้องการให้ทีมงาน Superadmin ช่วยตรวจสอบปัญหาทางบัญชีหรือออเดอร์ ร้านสามารถกด{' '}
          <strong className="text-stone-700 dark:text-stone-200">"อนุญาตให้ทีมงานเข้าถึงข้อมูลยอดขาย"</strong> ได้ชั่วคราว
          โดยระบบจะเพิกถอนสิทธิ์อัตโนมัติเมื่อครบกำหนด 24 หรือ 48 ชั่วโมง
          เพื่อปกป้องข้อมูลทางการเงินและความเป็นส่วนตัวของร้านค้าคุณ
        </p>

        {supportSuccessMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{supportSuccessMsg}</span>
          </div>
        )}

        {supportErrorMsg && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{supportErrorMsg}</span>
          </div>
        )}

        {isSupportActive ? (
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>สิทธิ์กำลังเปิดใช้งานอยู่ (หมดอายุในอีก ~{remainingHours} ชั่วโมง)</span>
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                หมดอายุวันที่:{' '}
                {new Date(supportExpiresAt!).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={isUpdatingSupport}
              onClick={handleRevokeAccess}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingSupport ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>ยกเลิกสิทธิ์ทันที</span>
            </button>
          </div>
        ) : (
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              disabled={isUpdatingSupport}
              onClick={() => handleGrantAccess(24)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingSupport ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>อนุญาต 24 ชั่วโมง</span>
            </button>

            <button
              type="button"
              disabled={isUpdatingSupport}
              onClick={() => handleGrantAccess(48)}
              className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingSupport ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>อนุญาต 48 ชั่วโมง</span>
            </button>
          </div>
        )}
      </div>

      {/* Shop Info & PromptPay Config Form */}
      <form
        onSubmit={handleSaveShopInfo}
        className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
          <CreditCard className="w-5 h-5 text-amber-600" />
          <span>ข้อมูลร้านค้าและพร้อมเพย์</span>
        </div>

        {shopSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว</span>
          </div>
        )}

        {shopError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{shopError}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">ชื่อร้านค้า</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                หมายเลขพร้อมเพย์ (เบอร์โทร 10 หลัก หรือ เลขบัตร ปชช. 13 หลัก)
              </label>
              <input
                type="text"
                value={promptpayId}
                onChange={(e) => setPromptpayId(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 0891234567"
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                ชื่อบัญชีพร้อมเพย์ (แสดงให้ลูกค้าตรวจสอบ)
              </label>
              <input
                type="text"
                value={promptpayName}
                onChange={(e) => setPromptpayName(e.target.value)}
                placeholder="เช่น นางสมศรี มีโชค"
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                ค่าบริการ Service Charge (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                รูปแบบภาษีมูลค่าเพิ่ม (VAT)
              </label>
              <select
                value={vatMode}
                onChange={(e) => setVatMode(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="none" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">ไม่คิด VAT</option>
                <option value="inclusive" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">รวมในราคาอาหารแล้ว (Inclusive 7%)</option>
                <option value="exclusive" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">คิดเพิ่มจากราคาอาหาร (Exclusive 7%)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSavingShop}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
