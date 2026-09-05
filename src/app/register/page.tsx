'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { registerUserAction } from '@/app/actions/auth';
import {
  Store,
  User,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  MailCheck,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  // Form states
  const [shopName, setShopName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email confirmation view state
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsLoading(true);

    const result = await registerUserAction({
      shop_name: shopName,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      password,
      origin: window.location.origin,
    });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'ไม่สามารถลงทะเบียนได้');
      return;
    }

    if (result.requiresEmailConfirmation) {
      setConfirmationEmail(result.email || email);
    } else {
      router.push('/admin/orders');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google');
      setIsGoogleLoading(false);
    }
  };

  // หากอยู่ในสถานะรอการยืนยันอีเมล
  if (confirmationEmail) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-amber-50/60 via-stone-50 to-stone-100">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-100/80 text-center space-y-6 animate-in fade-in duration-200">
          <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border-2 border-emerald-200 shadow-sm">
            <MailCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-stone-900">โปรดยืนยันอีเมลของคุณ</h1>
            <p className="text-xs text-stone-600 leading-relaxed">
              เราได้ส่งลิงก์ยืนยันตัวตนไปที่
            </p>
            <div className="text-sm font-bold text-amber-800 bg-amber-50 py-1.5 px-3 rounded-xl inline-block">
              {confirmationEmail}
            </div>
          </div>

          <div className="p-4 bg-stone-50 rounded-2xl text-xs text-stone-500 text-left space-y-1.5 border border-stone-200/60">
            <div className="font-semibold text-stone-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ขั้นตอนถัดไป:</span>
            </div>
            <p>1. เปิดกล่องข้อความอีเมลของคุณ (รวมถึงโฟลเดอร์ Junk/Spam)</p>
            <p>2. คลิกลิงก์ <b>"Confirm your email"</b> เพื่อเปิดใช้งานระบบร้านอาหาร</p>
            <p>3. เมื่อกดยืนยันแล้ว ระบบจะเปิดร้านและนำคุณเข้าสู่หน้าคิวออเดอร์ทันที</p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3.5 px-6 bg-stone-800 hover:bg-stone-900 text-white font-semibold rounded-2xl text-xs transition-colors"
            >
              ไปที่หน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-amber-50/60 via-stone-50 to-stone-100 py-12">
      <div className="max-w-lg w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-100/80 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto w-12 h-12 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/25">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">
            เปิดร้านอาหารและสมัครสมาชิก
          </h1>
          <p className="text-xs text-stone-500">
            สร้างระบบรับอาหารออนไลน์ ตรวจสลิปอัตโนมัติ และคิวออเดอร์
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div>
          <button
            type="button"
            disabled={isGoogleLoading || isLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-4 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold rounded-2xl shadow-xs flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>สมัคร / เข้าสู่ระบบด้วย Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-stone-400 font-medium">หรือสมัครด้วยอีเมล</span>
            </div>
          </div>
        </div>

        {/* Email Registration Form */}
        <form onSubmit={handleRegister} className="space-y-3.5">
          {/* Shop Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800">
              ชื่อร้านอาหารของคุณ <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="เช่น ครัวคุณยาย อาหารตามสั่ง"
                required
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800">
                ชื่อจริง <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="สมชาย"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800">
                นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="ใจดี"
                required
                className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800">
              เบอร์โทรศัพท์ <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 0812345678"
                maxLength={10}
                required
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800">
              อีเมล <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@restaurant.com"
                required
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800">
                รหัสผ่าน <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัว"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800">
                ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="พิมพ์รหัสผ่านซ้ำ"
                required
                minLength={6}
                className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>สร้างร้านและสมัครสมาชิก</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div className="pt-2 border-t border-stone-100 text-center text-xs text-stone-500">
          มีบัญชีร้านอาหารอยู่แล้ว?{' '}
          <Link href="/login" className="font-bold text-amber-700 hover:underline">
            เข้าสู่ระบบที่นี่
          </Link>
        </div>
      </div>
    </main>
  );
}
