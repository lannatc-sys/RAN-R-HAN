'use client';

import { LanguageToggle } from '@/lib/i18n/LanguageContext';
import { ThemeToggle } from '@/lib/theme/ThemeContext';

interface HeaderControlsProps {
  className?: string;
  showTheme?: boolean;
  showLanguage?: boolean;
}

export function HeaderControls({
  className = '',
  showTheme = true,
  showLanguage = true,
}: HeaderControlsProps) {
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      {showLanguage && <LanguageToggle />}
      {showTheme && <ThemeToggle />}
    </div>
  );
}
