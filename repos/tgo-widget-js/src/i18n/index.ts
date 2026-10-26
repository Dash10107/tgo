import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zh from './locales/zh.json'
import hi from './locales/hi.json'
import mr from './locales/mr.json'

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr', 'zh'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
  zh: { translation: zh },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    // Map regional variants such as hi-IN / mr-IN / en-GB to their base language
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
    },
  })

export default i18n
