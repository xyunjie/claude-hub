import { en, type MessageKey, type Messages } from './en.js';
import { zhHans } from './zh-Hans.js';
import { zhHant } from './zh-Hant.js';

export type { MessageKey, Messages };

export const LANGUAGES = ['en', 'zh', 'zh-Hans', 'zh-Hant', 'zh-TW'] as const;
export type Language = typeof LANGUAGES[number];

const LOCALES: Record<Language, Messages> = {
  en,
  zh: zhHans,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  'zh-TW': zhHant,
};

let current: Language = 'en';

export function setLanguage(lang: Language): void {
  current = lang;
}

// CJK terminals draw East Asian Ambiguous characters (box drawing, blocks) two cells wide.
export function isCjk(): boolean {
  return current !== 'en';
}

/** The message for `key`, with `{name}` placeholders filled from `params`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const pattern = LOCALES[current]?.[key] ?? en[key];
  return params ? pattern.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')) : pattern;
}
