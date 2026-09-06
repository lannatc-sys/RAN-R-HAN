'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'rab_r_han_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // ตรวจจับ System preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Update DOM class when theme or system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        isDark = mediaQuery.matches;
      }

      setResolvedTheme(isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    };

    applyTheme();

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    // สลับระหว่าง light กับ dark
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'system' as Theme,
      resolvedTheme: 'light' as const,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-xl bg-stone-100 dark:bg-stone-800/90 border border-stone-200/90 dark:border-stone-700 shadow-2xs transition-colors select-none ${className}`}
      role="group"
      aria-label="เลือกโหมดสว่างหรือโหมดมืด"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          resolvedTheme === 'light'
            ? 'bg-white text-amber-800 shadow-xs ring-1 ring-stone-900/5 font-extrabold'
            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
        }`}
        title="สลับเป็นโหมดสว่าง (Light Mode)"
        aria-pressed={resolvedTheme === 'light'}
      >
        <Sun className={`w-3.5 h-3.5 ${resolvedTheme === 'light' ? 'text-amber-500 fill-amber-500/20' : 'text-stone-400'}`} />
        <span className="text-[11px]">สว่าง</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          resolvedTheme === 'dark'
            ? 'bg-stone-900 text-amber-300 shadow-xs ring-1 ring-stone-700 font-extrabold'
            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
        }`}
        title="สลับเป็นโหมดมืด (Dark Mode)"
        aria-pressed={resolvedTheme === 'dark'}
      >
        <Moon className={`w-3.5 h-3.5 ${resolvedTheme === 'dark' ? 'text-amber-400 fill-amber-400/20' : 'text-stone-400'}`} />
        <span className="text-[11px]">มืด</span>
      </button>
    </div>
  );
}
