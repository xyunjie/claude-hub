import { en } from './en.js';
import { zhHans } from './zh-Hans.js';
import { zhHant } from './zh-Hant.js';
export const LANGUAGES = ['en', 'zh', 'zh-Hans', 'zh-Hant', 'zh-TW'];
const LOCALES = {
    en,
    zh: zhHans,
    'zh-Hans': zhHans,
    'zh-Hant': zhHant,
    'zh-TW': zhHant,
};
let current = 'en';
export function setLanguage(lang) {
    current = lang;
}
// CJK terminals draw East Asian Ambiguous characters (box drawing, blocks) two cells wide.
export function isCjk() {
    return current !== 'en';
}
/** The message for `key`, with `{name}` placeholders filled from `params`. */
export function t(key, params) {
    const pattern = LOCALES[current]?.[key] ?? en[key];
    return params ? pattern.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '')) : pattern;
}
//# sourceMappingURL=index.js.map