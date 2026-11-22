/**
 * Rule text lives in JSON, never in rule code. A rule reports a detail by key and values;
 * this module turns that into a sentence in one language. The CLI uses the English catalog,
 * the playground also uses the Malay file in ./i18n.
 */

/** A detail a rule attaches to a finding: a template key and the values it fills in. */
export interface DetailRef {
  key: string;
  values?: Readonly<Record<string, string | number | readonly string[]>>;
}

/** The text of one rule in one language. */
export interface RuleText {
  message: string;
  fix: string;
  /** Detail templates. `{name}` is replaced by the value of the same name. */
  details?: Readonly<Record<string, string>>;
  /** Words a list value may name by key, such as `counter` for "a changing counter". */
  terms?: Readonly<Record<string, string>>;
}

const PLACEHOLDER = /\{([a-zA-Z]+)\}/g;

/** The Intl locale used to join lists. English uses en-GB so a list reads "a, b and c". */
function listLocale(lang: string): string {
  return lang === 'en' ? 'en-GB' : lang;
}

/** The placeholder names a template uses, in order. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1] as string);
}

/** Renders one detail. Throws when the template or a value is missing, so a broken catalog fails its tests. */
export function renderDetail(text: RuleText, ref: DetailRef, lang: string): string {
  const template = text.details?.[ref.key];
  if (template === undefined) throw new Error(`no detail template "${ref.key}"`);
  const join = new Intl.ListFormat(listLocale(lang), { style: 'long', type: 'conjunction' });
  return template.replace(PLACEHOLDER, (_, name: string) => {
    const value = ref.values?.[name];
    if (value === undefined) throw new Error(`detail "${ref.key}" has no value for {${name}}`);
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return join.format(value.map((item) => text.terms?.[item] ?? item));
  });
}

/** The full message of a finding: the rule message, then the detail when there is one. */
export function renderMessage(text: RuleText, ref: DetailRef | undefined, lang: string): string {
  return ref ? `${text.message} ${renderDetail(text, ref, lang)}` : text.message;
}
