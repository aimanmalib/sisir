import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyEvidence, readEvidence, writeEvidence } from '../src/evidence.js';

const dirs: string[] = [];
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), 'sisir-evidence-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('evidence record', () => {
  it('creates the evidence folder on the first write, so the first transfer is recorded', () => {
    const path = join(scratch(), 'evidence', 'testnet.json');
    const e = emptyEvidence('qorechain-diana');
    e.funding = { tx: 'AB', height: 7, gasUsed: 1, from: 'qor1a', to: 'qor1b', amount: '5000000', denom: 'uqor' };
    writeEvidence(path, e);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(e);
    expect(readEvidence(path, 'qorechain-diana').funding?.tx).toBe('AB');
  });

  it('refuses a record written for another network', () => {
    const path = join(scratch(), 'testnet.json');
    writeEvidence(path, emptyEvidence('other-net'));
    expect(() => readEvidence(path, 'qorechain-diana')).toThrow(/other-net/);
  });
});
