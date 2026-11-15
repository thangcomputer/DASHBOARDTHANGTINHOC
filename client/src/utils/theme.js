import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'cms_theme';
const THEME_EVENT = 'cms:theme-change';

export function getThemePreference() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch { /* ignore */ }
  return 'light';
}

export function resolveTheme(pref = getThemePreference()) {
  if (pref === 'dark') return 'dark';
  if (pref === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function getResolvedTheme() {
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
  return resolveTheme();
}

export function applyTheme(pref = getThemePreference()) {
  const resolved = resolveTheme(pref);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.classList.toggle('dark', resolved === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1018' : '#ffffff');
  }
  return resolved;
}

export function setThemePreference(pref) {
  const next = pref === 'dark' || pref === 'system' ? pref : 'light';
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch { /* ignore */ }
  const resolved = applyTheme(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { preference: next, resolved } }));
  }
  return resolved;
}

export function toggleTheme() {
  const current = getResolvedTheme();
  return setThemePreference(current === 'dark' ? 'light' : 'dark');
}

export function useTheme() {
  const [preference, setPreferenceState] = useState(getThemePreference);
  const [resolved, setResolved] = useState(getResolvedTheme);

  useEffect(() => {
    const sync = () => {
      const nextPref = getThemePreference();
      setPreferenceState(nextPref);
      setResolved(applyTheme(nextPref));
    };
    sync();

    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getThemePreference() === 'system') sync();
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    mql?.addEventListener?.('change', onSystemChange);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
      mql?.removeEventListener?.('change', onSystemChange);
    };
  }, []);

  const toggle = useCallback(() => toggleTheme(), []);
  const setTheme = useCallback((next) => setThemePreference(next), []);

  return {
    theme: resolved,
    preference,
    isDark: resolved === 'dark',
    toggle,
    setTheme,
  };
}

