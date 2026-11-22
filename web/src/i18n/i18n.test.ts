import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import { dictionaries, translate } from "./i18n.js";

// Every source file of the playground, to find the keys it asks for.
const sources = import.meta.glob<string>("../**/*.tsx", { query: "?raw", import: "default", eager: true });

function keys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("locales", () => {
  it("has the same keys in every language", () => {
    for (const messages of Object.values(dictionaries)) expect(keys(messages).sort()).toEqual(keys(en).sort());
  });

  it("has every literal key the components ask for", () => {
    const asked = new Set<string>();
    for (const [file, text] of Object.entries(sources)) {
      if (file.endsWith(".test.tsx")) continue;
      for (const m of text.matchAll(/\bt\(\s*["'`]([a-zA-Z.]+)["'`]/g)) asked.add(m[1] as string);
    }
    expect(asked.size).toBeGreaterThan(10);
    for (const key of asked) expect(translate(en, key), key).not.toBe(key);
  });

  it("fills placeholders and shows a missing key as itself", () => {
    expect(translate(en, "tag.line", { line: 7 })).toBe("Line 7");
    expect(translate(en, "no.such.key")).toBe("no.such.key");
  });
});
