import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Compact header pill ("VI | EN") or full settings card ("Tiếng Việt" / "English").
 * Marked with data-no-translate so language names never get rewritten by auto-translation.
 */
export default function LanguageSwitcher({
  variant = 'pill',
  theme = 'light',
  className = '',
}) {
  const { language, setLanguage } = useLanguage();

  if (variant === 'card') {
    const options = [
      { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt', sub: 'Mặc định' },
      { code: 'en', flag: '🇺🇸', label: 'English', sub: 'International' },
    ];

    return (
      <div
        data-no-translate="true"
        className={`rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 shadow-sm ${className}`}
      >
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-300">
            <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{language === 'en' ? 'Language' : 'Ngôn ngữ'}</span>
          </div>
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            {language === 'en' ? 'English' : 'Tiếng Việt'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt) => {
            const active = language === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLanguage(opt.code)}
                aria-pressed={active}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                  active
                    ? 'border-emerald-500 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/55 dark:text-emerald-100 shadow-sm ring-1 ring-emerald-500/30 dark:ring-emerald-400/30'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {opt.flag}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-extrabold">{opt.label}</div>
                  <div className={`truncate text-[10px] font-semibold ${active ? 'text-emerald-700/80 dark:text-emerald-200/85' : 'text-slate-500 dark:text-slate-400'}`}>
                    {opt.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const containerClass = isDark
    ? 'border-white/20 bg-slate-900/60 text-white'
    : 'border-slate-200/90 bg-white/95 text-slate-700 shadow-sm';

  return (
    <div
      data-no-translate="true"
      role="group"
      aria-label={language === 'en' ? 'Language selector' : 'Chọn ngôn ngữ'}
      className={`inline-flex items-center gap-1 rounded-full border p-0.5 backdrop-blur-sm ${containerClass} ${className}`}
    >
      <Globe
        className={`ml-1.5 h-3.5 w-3.5 shrink-0 ${
          isDark ? 'text-emerald-300' : 'text-emerald-600'
        }`}
        aria-hidden="true"
      />
      {[
        { code: 'vi', label: 'VI', title: 'Tiếng Việt' },
        { code: 'en', label: 'EN', title: 'English' },
      ].map((opt) => {
        const active = language === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            aria-pressed={active}
            title={opt.title}
            className={`rounded-full px-2 py-1 text-[11px] font-extrabold tracking-wide transition-all ${
              active
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDark
                  ? 'text-slate-200 hover:bg-white/10'
                  : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
