import data from './catalog.json' with { type: 'json' };
import type { CatalogEntry, Level } from './types.js';

const LEVELS: readonly Level[] = ['error', 'warning', 'info'];

/** True for a plain object whose values are all non-empty strings. */
export function isTextMap(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === 'string' && v.trim() !== '');
}

/** Checks the shape of a catalog and returns it indexed by rule id. */
export function loadCatalog(raw: unknown): Map<string, CatalogEntry> {
  const rules = (raw as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) throw new Error('catalog: "rules" must be an array');
  const byId = new Map<string, CatalogEntry>();
  for (const r of rules as Partial<CatalogEntry>[]) {
    for (const key of ['id', 'name', 'docs', 'message', 'fix'] as const) {
      if (typeof r[key] !== 'string' || r[key].trim() === '') {
        throw new Error(`catalog: rule ${r.id ?? '?'} has no "${key}"`);
      }
    }
    if (!LEVELS.includes(r.level as Level)) throw new Error(`catalog: rule ${r.id} has an unknown level`);
    if (!/^https:\/\//.test(r.docs as string)) throw new Error(`catalog: rule ${r.id} docs must be an https URL`);
    for (const key of ['details', 'terms'] as const) {
      const map = r[key];
      if (map !== undefined && !isTextMap(map)) throw new Error(`catalog: rule ${r.id} "${key}" must map names to text`);
    }
    if (byId.has(r.id as string)) throw new Error(`catalog: rule ${r.id} is listed twice`);
    byId.set(r.id as string, r as CatalogEntry);
  }
  return byId;
}

export const catalog: ReadonlyMap<string, CatalogEntry> = loadCatalog(data);
