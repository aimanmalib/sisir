import { describe, expect, it } from 'vitest';
import { classifyAnchorError } from './errors.js';

function wrapped(inner: unknown): Error {
  // viem wraps the wallet's answer: the cause chain carries it.
  return Object.assign(new Error('The contract function "anchor" reverted.'), { cause: inner });
}

describe('anchor error kinds', () => {
  it('reads a user rejection through the cause chain', () => {
    expect(classifyAnchorError(wrapped({ code: 4001, message: 'User rejected the request.' }))).toBe('rejected');
  });

  it('tells QoreX refusing an EVM signing method apart from a chain refusal', () => {
    expect(classifyAnchorError(wrapped(new Error('QoreX: EVM method eth_sendTransaction not yet supported')))).toBe('unsupported');
  });

  it('names the ledger refusing an account without a proven key', () => {
    expect(classifyAnchorError(wrapped(new Error('reverted with custom error NotQuantumReady(0xabc)')))).toBe('notReady');
  });

  it('falls back to a plain failure for anything else', () => {
    expect(classifyAnchorError(new Error('socket hang up'))).toBe('failed');
  });
});
