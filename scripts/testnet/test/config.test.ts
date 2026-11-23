import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTestnetConfig, feeFor, fromBase, loadConfig, toBase } from '../src/config.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const raw = (): Record<string, any> => JSON.parse(readFileSync(`${root}config/testnet.json`, 'utf8'));

describe('config/testnet.json', () => {
  it('loads with the chain block of config/app.json', () => {
    const { testnet, chain } = loadConfig(root);
    expect(chain.nativeId).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(Object.values(testnet.accounts)).size).toBe(3);
  });

  it('refuses two roles on one account index', () => {
    const c = raw();
    c.accounts.keyless = c.accounts.project;
    expect(() => checkTestnetConfig(c)).toThrow(/repeats index/);
  });

  it('refuses an amount that is not a decimal string', () => {
    const c = raw();
    c.funding.amountQor = 5;
    expect(() => checkTestnetConfig(c)).toThrow(/funding.amountQor/);
  });

  it('refuses an evidence path outside the repository', () => {
    const c = raw();
    c.evidence = '../evidence.json';
    expect(() => checkTestnetConfig(c)).toThrow(/inside the repository/);
  });

  it('refuses a REST URL that is not http(s)', () => {
    const c = raw();
    c.rest = 'ftp://example';
    expect(() => checkTestnetConfig(c)).toThrow(/rest/);
  });
});

describe('amounts', () => {
  it('converts QOR to base units and back', () => {
    expect(toBase('5', 6)).toBe(5_000_000n);
    expect(toBase('0.000001', 6)).toBe(1n);
    expect(fromBase(5_000_000n, 6)).toBe('5');
    expect(fromBase(1_250_000n, 6)).toBe('1.25');
    expect(fromBase(1n, 6)).toBe('0.000001');
  });

  it('refuses more decimals than the denom has, and signs', () => {
    expect(() => toBase('0.0000001', 6)).toThrow(/decimals/);
    expect(() => toBase('-1', 6)).toThrow(/not a QOR amount/);
  });

  it('prices a fee from the gas limit and price, rounded up', () => {
    const c = checkTestnetConfig({ ...raw(), gasPriceUqor: '0.15', gas: { send: 3, registerKey: 10 } });
    expect(feeFor(c, 'send')).toEqual({ amount: [{ denom: c.denom, amount: '1' }], gas: '3' });
    expect(feeFor(c, 'registerKey', 2).amount[0]!.amount).toBe('3');
  });
});
