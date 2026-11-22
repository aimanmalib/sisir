import { describe, expect, it } from 'vitest';
import { toQorAddress } from '@qorechain/evm/window';
import { config } from '../config.js';
import { openWindowMessage } from './windowMessage.js';

const SENDER = toQorAddress('0x0102030405060708090a0b0c0d0e0f1011121314');
const TARGET = '0x00000000000000000000000000000000000000AB';

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Protobuf varint, written out here so the test does not reuse the code under test. */
function varintHex(n: number): string {
  let out = '';
  let v = n;
  while (v > 0x7f) {
    out += ((v & 0x7f) | 0x80).toString(16).padStart(2, '0');
    v = Math.floor(v / 128);
  }
  return out + v.toString(16).padStart(2, '0');
}

function hexText(s: string): string {
  return hexOf(new TextEncoder().encode(s));
}

describe('MsgOpenEVMWindow for the anchor step', () => {
  it('encodes sender, blocks, max txs, max value and the one allowed target as protobuf fields 1, 2, 3, 4 and 6', () => {
    const msg = openWindowMessage({ sender: SENDER, target: TARGET });
    expect(msg.typeUrl).toBe('/qorechain.pqc.v1.MsgOpenEVMWindow');
    const a = config.anchor;
    // Gas limit x fee cap in wei, rounded up to uqor (10^12 wei), once per admitted transaction.
    const perTx = (BigInt(a.gasLimit) * BigInt(a.maxFeePerGasWei) + 10n ** 12n - 1n) / 10n ** 12n;
    const maxValue = String(perTx * BigInt(a.windowMaxTxs));
    const target = TARGET.toLowerCase();
    const expected =
      `0a${varintHex(SENDER.length)}${hexText(SENDER)}` +
      `10${varintHex(a.windowBlocks)}` +
      `18${varintHex(a.windowMaxTxs)}` +
      `22${varintHex(maxValue.length)}${hexText(maxValue)}` +
      `32${varintHex(target.length)}${hexText(target)}`;
    expect(hexOf(msg.value)).toBe(expected);
    // The worked example from the kit: 600 blocks is the varint d8 04.
    expect(varintHex(600)).toBe('d804');
  });

  it('refuses a malformed sender before anything reaches the wallet', () => {
    expect(() => openWindowMessage({ sender: 'cosmos1abc', target: TARGET })).toThrow(/Not a QoreChain account/);
    expect(() => openWindowMessage({ sender: `${SENDER.slice(0, -1)}x`, target: TARGET })).toThrow();
  });
});
