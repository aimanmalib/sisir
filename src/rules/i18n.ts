import ms from './i18n/ms.json' with { type: 'json' };
import { catalog, isTextMap } from './catalog.js';
import type { RuleText } from './text.js';

/** Languages the rule text exists in. English is the catalog itself. */
export const languages = ['en', 'ms'] as const;
export type Language = (typeof languages)[number];

const translations: Readonly<Record<Exclude<Language, 'en'>, unknown>> = { ms };

/** The text of one rule in one language, read from catalog.json or i18n/<lang>.json. */
export function ruleText(id: string, lang: Language): RuleText {
  const entry = catalog.get(id);
  if (!entry) throw new Error(`no rule ${id}`);
  if (lang === 'en') return entry;
  const raw = (translations[lang] as { rules?: Record<string, Partial<RuleText>> }).rules?.[id];
  if (!raw || typeof raw.message !== 'string' || typeof raw.fix !== 'string') throw new Error(`rule ${id} has no ${lang} text`);
  for (const key of ['details', 'terms'] as const) {
    if (raw[key] !== undefined && !isTextMap(raw[key])) throw new Error(`rule ${id} ${lang} "${key}" must map names to text`);
  }
  return raw as RuleText;
}
