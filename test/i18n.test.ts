import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog, languages, lintSource, placeholders, renderDetail, renderMessage, ruleText, rules } from '../src/rules/index.js';

const fixtures = new URL('../fixtures/rules/', import.meta.url);

/** Every finding the rule fixtures and the workshop vaults produce. */
function allFindings() {
  const out = [];
  for (const id of readdirSync(fixtures)) {
    for (const name of readdirSync(new URL(`${id}/`, fixtures))) {
      const source = readFileSync(new URL(`${id}/${name}`, fixtures), 'utf8');
      out.push(...lintSource(source, { file: name, rules }).findings);
    }
  }
  for (const name of ['QDayVault_v0_buggy.sol', 'QDayVault_v1_fixed.sol']) {
    const source = readFileSync(new URL(`../fixtures/workshop/${name}`, import.meta.url), 'utf8');
    out.push(...lintSource(source, { file: name, rules }).findings);
  }
  return out;
}

describe('rule text in every language', () => {
  for (const id of catalog.keys()) {
    it(`${id} has the same detail keys, terms and placeholders in every language`, () => {
      const en = ruleText(id, 'en');
      for (const lang of languages) {
        const text = ruleText(id, lang);
        expect(text.message.trim(), `${id} ${lang} message`).not.toBe('');
        expect(text.fix.trim(), `${id} ${lang} fix`).not.toBe('');
        expect(Object.keys(text.details ?? {}).sort(), `${id} ${lang} details`).toEqual(Object.keys(en.details ?? {}).sort());
        expect(Object.keys(text.terms ?? {}).sort(), `${id} ${lang} terms`).toEqual(Object.keys(en.terms ?? {}).sort());
        for (const [key, template] of Object.entries(en.details ?? {})) {
          expect(placeholders(text.details?.[key] ?? '').sort(), `${id} ${lang} ${key}`).toEqual(placeholders(template).sort());
        }
      }
    });
  }

  it('every finding from the fixtures carries a detail that renders in every language', () => {
    const found = allFindings();
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(f.detail, `${f.ruleId} ${f.file}:${f.line}`).toBeDefined();
      expect(renderMessage(ruleText(f.ruleId, 'en'), f.detail, 'en')).toBe(f.message);
      for (const lang of languages) expect(() => renderMessage(ruleText(f.ruleId, lang), f.detail, lang)).not.toThrow();
    }
  });

  it('S007 joins the missing parts with the words of the language', () => {
    const ref = { key: 'leavesOut', values: { parts: ['chainid', 'self', 'counter'] } };
    expect(renderDetail(ruleText('S007', 'en'), ref, 'en')).toBe('It leaves out block.chainid, address(this) and a changing counter.');
    expect(renderDetail(ruleText('S007', 'ms'), ref, 'ms')).toBe('Ia tidak memasukkan block.chainid, address(this) dan pembilang yang berubah.');
  });

  it('S003 picks the singular or plural template by the number of unread fields', () => {
    const en = ruleText('S003', 'en');
    expect(renderDetail(en, { key: 'unreadOne', values: { fields: ['possessionProven'] } }, 'en')).toBe('possessionProven is never read.');
    expect(renderDetail(en, { key: 'unreadMany', values: { fields: ['registered', 'possessionProven'] } }, 'en')).toBe(
      'registered and possessionProven are never read.',
    );
  });

  it('refuses a detail key or value the catalog does not have', () => {
    const en = ruleText('S001', 'en');
    expect(() => renderDetail(en, { key: 'nope' }, 'en')).toThrow(/nope/);
    expect(() => renderDetail(en, { key: 'pointsAt' }, 'en')).toThrow(/\{name\}/);
  });
});
