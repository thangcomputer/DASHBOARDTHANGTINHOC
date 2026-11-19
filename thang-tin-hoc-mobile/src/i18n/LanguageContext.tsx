import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LANGUAGE,
  LANG_STORAGE_KEY,
  MOBILE_LANG_STORAGE_KEY,
  normalizeLanguage,
  translateText,
  viOrEn,
} from '../../../shared/i18n/translate.mjs';

export type AppLanguage = 'vi' | 'en';

let currentLanguage: AppLanguage = readInitialWebLanguage();
const listeners = new Set<(lang: AppLanguage) => void>();

function readInitialWebLanguage(): AppLanguage {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const fromWebKey = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (fromWebKey) return normalizeLanguage(fromWebKey);
      const fromMobileKey = window.localStorage.getItem(MOBILE_LANG_STORAGE_KEY);
      if (fromMobileKey) return normalizeLanguage(fromMobileKey);
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LANGUAGE;
}

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

export function subscribeLanguage(listener: (lang: AppLanguage) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setGlobalLanguage(next: AppLanguage) {
  currentLanguage = next;
  if (Platform.OS === 'web' && typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = next;
  }
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      // ignore subscriber failure
    }
  });
}

async function persistLanguage(lang: AppLanguage) {
  try {
    await AsyncStorage.setItem(MOBILE_LANG_STORAGE_KEY, lang);
  } catch {
    // ignore native AsyncStorage errors
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
      window.localStorage.setItem(MOBILE_LANG_STORAGE_KEY, lang);
    } catch {
      // ignore storage quota errors
    }
  }
}

export interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: unknown) => void;
  toggleLanguage: () => void;
  t: (vi: string, en?: string) => string;
  tr: (text: string) => string;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (vi) => vi,
  tr: (text) => text,
  isEnglish: false,
});

export const LanguageCodeContext = createContext<AppLanguage | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(currentLanguage);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(MOBILE_LANG_STORAGE_KEY);
        if (!active) return;
        const normalized = stored
          ? normalizeLanguage(stored)
          : readInitialWebLanguage();
        if (normalized !== currentLanguage) {
          setGlobalLanguage(normalized);
          setLanguageState(normalized);
        }
      } catch {
        // ignore startup read failure
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANG_STORAGE_KEY || event.key === MOBILE_LANG_STORAGE_KEY) {
        const next = normalizeLanguage(event.newValue);
        if (next !== currentLanguage) {
          setGlobalLanguage(next);
          setLanguageState(next);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLanguage = useCallback((next: unknown) => {
    const normalized = normalizeLanguage(next);
    setGlobalLanguage(normalized);
    setLanguageState(normalized);
    void persistLanguage(normalized);
  }, []);

  const toggleLanguage = useCallback(() => {
    const next: AppLanguage = currentLanguage === 'vi' ? 'en' : 'vi';
    setLanguage(next);
  }, [setLanguage]);

  const t = useCallback(
    (vi: string, en?: string) =>
      en !== undefined ? viOrEn(language, vi, en) : translateText(vi, language),
    [language]
  );

  const tr = useCallback((text: string) => translateText(text, language), [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      tr,
      isEnglish: language === 'en',
    }),
    [language, setLanguage, toggleLanguage, t, tr]
  );

  return (
    <LanguageCodeContext.Provider value={language}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </LanguageCodeContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
