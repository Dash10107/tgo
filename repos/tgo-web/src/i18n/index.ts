import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import language resources

import enTranslations from './locales/en.json';
import hiTranslations from './locales/hi.json';
import mrTranslations from './locales/mr.json';
import zhTranslations from './locales/zh.json';


/**
 * i18n Configuration for Pelatis Web
 * Supports English (default), Hindi, Marathi and Chinese
 */
const resources = {
  en: {
    translation: enTranslations
  },
  hi: {
    translation: hiTranslations
  },
  mr: {
    translation: mrTranslations
  },
  zh: {
    translation: zhTranslations
  }
};

// Determine initial language with support for 'system'/'auto' preference
export const SUPPORTED_LANGS = ['en', 'hi', 'mr', 'zh'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];
const DEFAULT_LANG: SupportedLang = 'en';

const isSupportedLang = (code: string): code is SupportedLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(code);

/** Map any BCP-47 tag (e.g. 'hi-IN', 'mr', 'zh-CN') to a supported base language, defaulting to English. */
export const mapToSupportedLang = (lng?: string | null): SupportedLang => {
  const base = (lng || '').toLowerCase().split(/[-_]/)[0];
  return isSupportedLang(base) ? base : DEFAULT_LANG;
};

/** Resolve the best supported language from the browser's preferred languages. */
export const detectSystemLang = (): SupportedLang => {
  if (typeof navigator !== 'undefined') {
    const prefs = Array.isArray((navigator as any).languages) && (navigator as any).languages.length
      ? (navigator as any).languages as string[]
      : [(navigator as any).language as string];
    for (const cand of prefs) {
      const base = (cand || '').toLowerCase().split(/[-_]/)[0];
      if (isSupportedLang(base)) return base;
    }
  }
  return DEFAULT_LANG;
};

let storedPref: string | null = null;
try {
  storedPref = typeof localStorage !== 'undefined' ? localStorage.getItem('tgo-language') : null;
} catch {}

const initialLng: SupportedLang = (storedPref === 'system' || storedPref === 'auto' || !storedPref)
  ? detectSystemLang()
  : isSupportedLang(storedPref)
    ? storedPref
    : detectSystemLang();


i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANG, // Default to English if detection fails or a key is missing
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true,
    lng: initialLng, // Respect stored 'system/auto' or detected language

    // Language detection options (kept for compatibility, but we manage our own preference)
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tgo-language'
    },

    interpolation: {
      escapeValue: false // React already escapes values
    },

    // Debugging (disable in production)
    debug: import.meta.env.DEV
  });

// Keep <html lang> in sync
try {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', initialLng);
  }
} catch {}

i18n.on('languageChanged', (lng) => {
  try {
    if (typeof document !== 'undefined') {
      const base = (lng || '').split('-')[0];
      document.documentElement.setAttribute('lang', base || initialLng);
    }
  } catch {}
});

export default i18n;
