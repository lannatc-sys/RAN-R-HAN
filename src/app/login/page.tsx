'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Store, Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      if (errorParam === 'auth_failed' || errorParam.includes('access_denied')) {
        setErrorMessage('การเข้าสู่ระบบผ่าน Google ถูกยกเลิกหรือไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      } else if (errorParam.includes('provider is not enabled')) {
        setErrorMessage('ระบบยังไม่ได้เปิดใช้งาน Google Provider บน Supabase กรุณาเปิดใช้งานใน Authentication > Providers');
      } else {
        setErrorMessage(decodeURIComponent(errorParam));
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (error.message.includes('Email not confirmed')) {
        setErrorMessage('อีเมลนี้ยังไม่ได้รับการยืนยันตัวตน กรุณาตรวจสอบลิงก์ในกล่องข้อความอีเมลของคุณ');
      } else {
        setErrorMessage(error.message);
      }
      return;
    }

    router.push('/admin/orders');
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
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-amber-50/60 via-stone-50 to-stone-100">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-amber-900/5 border border-amber-100/80 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/25">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">เข้าสู่ระบบหลังร้าน</h1>
          <p className="text-xs text-stone-500">สำหรับเจ้าของร้านและพนักงาน (POS & KDS)</p>
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
            <span>เข้าสู่ระบบด้วย Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-stone-400 font-medium">หรือเข้าสู่ระบบด้วยอีเมล</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">อีเมล</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@restaurant.com"
                required
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full py-3.5 px-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2 transition-all text-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>เข้าสู่ระบบ</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-stone-100 text-center text-xs text-stone-500 space-y-2">
          <div>
            ยังไม่มีบัญชีร้านอาหาร?{' '}
            <Link href="/register" className="font-bold text-amber-700 hover:underline">
              สมัครเปิดร้านที่นี่
            </Link>
          </div>
          <div>
            <Link href="/" className="text-stone-400 hover:text-stone-600 transition-colors">
              ← กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-amber-50/60 via-stone-50 to-stone-100">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
