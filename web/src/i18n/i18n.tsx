import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '@sisir/rules';
import en from '../../locales/en.json';
import ms from '../../locales/ms.json';
import { config } from '../config.js';

export type Messages = typeof en;
export const dictionaries: Readonly<Record<Language, Messages>> = { en, ms };
const STORAGE_KEY = 'sisir.lang';

type Values = Readonly<Record<string, string | number>>;

/** Looks up a dotted key such as "tag.fix" and fills `{name}` placeholders. A missing key shows the key itself. */
export function translate(messages: Messages, key: string, values?: Values): string {
  let node: unknown = messages;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== 'string') return key;
  return node.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) => (values?.[name] !== undefined ? String(values[name]) : match));
}

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && value in dictionaries;
}

/** ?lang= wins, then the last choice, then the browser, then config/app.json. */
export function initialLanguage(): Language {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (isLanguage(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage can be blocked (private mode); the other sources still decide.
  }
  if (navigator.language.toLowerCase().startsWith('ms')) return 'ms';
  return isLanguage(config.playground.defaultLanguage) ? config.playground.defaultLanguage : 'en';
}

interface I18n {
  lang: Language;
  setLang(lang: Language): void;
  t(key: string, values?: Values): string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [lang, setLangState] = useState<Language>(() => initial ?? initialLanguage());
  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; the choice still holds for this visit.
    }
  }, []);
  const t = useCallback((key: string, values?: Values) => translate(dictionaries[lang], key, values), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  }, [lang, t]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n needs an I18nProvider');
  return ctx;
}
