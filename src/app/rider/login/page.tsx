'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage, LanguageToggle } from '@/lib/i18n/LanguageContext';
import { ThemeToggle } from '@/lib/theme/ThemeContext';
import { getRiderT } from '@/lib/i18n/rider-translations';
import { Bike, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function RiderLoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const rt = getRiderT(lang);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage(rt.loginFailed);
      setIsLoading(false);
      return;
    }

    router.replace('/rider');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex flex-col px-4 pb-safe pt-safe">
      <div className="flex justify-end gap-2 pt-4">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Bike className="w-8 h-8 text-white" />
            </div>
            <h1 className="mt-4 text-xl font-bold">{rt.appName}</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">{rt.login}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="rider-email" className="block text-sm font-medium mb-1.5">
                {rt.email}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="rider-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rider-password" className="block text-sm font-medium mb-1.5">
                {rt.password}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="rider-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {rt.signIn}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
