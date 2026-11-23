import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ACCOUNTS_ENV, accountsPath, readMnemonic } from '../src/accounts.js';

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'sisir-accounts-'));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('accountsPath', () => {
  it('needs the variable, an absolute path, and a place outside the repository', () => {
    expect(() => accountsPath({}, '/repo')).toThrow(ACCOUNTS_ENV);
    expect(() => accountsPath({ [ACCOUNTS_ENV]: 'keys.json' }, '/repo')).toThrow(/absolute/);
    expect(() => accountsPath({ [ACCOUNTS_ENV]: '/repo/state/keys.json' }, '/repo')).toThrow(/inside the repository/);
    expect(() => accountsPath({ [ACCOUNTS_ENV]: '/repo' }, '/repo')).toThrow(/inside the repository/);
    expect(accountsPath({ [ACCOUNTS_ENV]: '/home/x/keys.json' }, '/repo')).toBe('/home/x/keys.json');
  });
});

describe('readMnemonic', () => {
  const words = 'test only phrase';

  it('reads a 600 file of the known shape', () => {
    const p = join(tmp(), 'a.json');
    writeFileSync(p, JSON.stringify({ version: 1, mnemonic: words }), { mode: 0o600 });
    expect(readMnemonic(p)).toBe(words);
  });

  it('refuses a file others can read', () => {
    const p = join(tmp(), 'a.json');
    writeFileSync(p, JSON.stringify({ version: 1, mnemonic: words }));
    chmodSync(p, 0o644);
    expect(() => readMnemonic(p)).toThrow(/must be 600/);
  });

  it('refuses an unknown shape, and never quotes the file in the error', () => {
    const p = join(tmp(), 'a.json');
    writeFileSync(p, `{"version":1,"mnemonic":"${words}"`, { mode: 0o600 });
    let msg = '';
    try {
      readMnemonic(p);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toBe('accounts file is not JSON');
    writeFileSync(p, JSON.stringify({ version: 2, mnemonic: words }), { mode: 0o600 });
    expect(() => readMnemonic(p)).toThrow(/unknown shape/);
  });
});
