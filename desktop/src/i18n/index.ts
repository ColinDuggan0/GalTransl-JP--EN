import { en, type TranslationKey } from './en';
import { zhCN } from './zh-CN';

export type { TranslationKey } from './en';

export type Language = 'en' | 'zh-CN';

const DEFAULT_LANGUAGE: Language = 'en';
const FALLBACK_LANGUAGE: Language = 'zh-CN';

const dictionaries = {
  en,
  'zh-CN': zhCN,
} satisfies Record<Language, Partial<Record<TranslationKey, string>>>;

let currentLanguage: Language = DEFAULT_LANGUAGE;

export function setLanguage(language: Language) {
  currentLanguage = language;
}

export function getLanguage() {
  return currentLanguage;
}

export function getLocale() {
  return currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US';
}

export function t(key: TranslationKey, values?: Record<string, string | number>) {
  const template = dictionaries[currentLanguage][key] ?? dictionaries[FALLBACK_LANGUAGE][key] ?? key;
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
