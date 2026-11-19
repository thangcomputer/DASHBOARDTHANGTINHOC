import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANG_STORAGE_KEY,
  normalizeLanguage,
  translateText,
  viOrEn,
} from '../../../shared/i18n/translate.mjs';
import { startDomAutoTranslation } from '../i18n/domAutoTranslator';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (vi) => vi,
  tr: (text) => text,
  isEnglish: false,
});

function readStoredLanguage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_LANGUAGE;
    return normalizeLanguage(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const langRef = useRef(language);
  const translatorRef = useRef(null);

  langRef.current = language;

  const setLanguage = useCallback((next) => {
    const normalized = normalizeLanguage(next);
    setLanguageState(normalized);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
      }
    } catch {
      // ignore storage quota / private mode failures
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = normalized;
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(langRef.current === 'vi' ? 'en' : 'vi');
  }, [setLanguage]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    const controller = startDomAutoTranslation(() => langRef.current);
    translatorRef.current = controller;
    return () => {
      controller.destroy?.();
      translatorRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    translatorRef.current?.applyNow?.();
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === LANG_STORAGE_KEY) {
        setLanguageState(normalizeLanguage(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = useCallback(
    (vi, en) => (en !== undefined ? viOrEn(language, vi, en) : translateText(vi, language)),
    [language]
  );

  const tr = useCallback((text) => translateText(text, language), [language]);

  const value = useMemo(
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

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
