'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from './translations';
import { Globe } from 'lucide-react';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: typeof translations.th;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'rab_r_han_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('th');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
      if (saved === 'th' || saved === 'en') {
        setLangState(saved);
      } else {
        // ตรวจสอบภาษาของเบราว์เซอร์
        const browserLang = navigator.language?.toLowerCase() || '';
        if (browserLang.startsWith('en')) {
          setLangState('en');
        }
      }
    } catch {
      // Ignore storage errors in private browsing
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignore storage errors
    }
  };

  const toggleLang = () => {
    setLang(lang === 'th' ? 'en' : 'th');
  };

  const t = translations[lang] || translations.th;

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return fallback for safe rendering before context hydration
    return {
      lang: 'th' as Language,
      setLang: () => {},
      toggleLang: () => {},
      t: translations.th,
    };
  }
  return context;
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLang}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer select-none ${
        lang === 'en'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
          : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
      } ${className}`}
      title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
      aria-label="Toggle language"
    >
      <Globe className="w-3.5 h-3.5 shrink-0 opacity-80" />
      <span className="font-mono tracking-wider">{lang.toUpperCase()}</span>
    </button>
  );
}
