import { checkOpenEvmWindowParams, evmWindowCost, OPEN_EVM_WINDOW_TYPE_URL, toEvmAddress } from '@qorechain/evm/window';
import { config } from '../config.js';

/** A native-lane message as QoreX `signAndBroadcast` takes it: type URL and protobuf bytes. */
export interface EncodedMessage {
  typeUrl: string;
  value: Uint8Array;
}

const utf8 = new TextEncoder();

function varint(out: number[], value: bigint): void {
  let v = value;
  while (v > 0x7fn) {
    out.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
}

function stringField(out: number[], field: number, value: string): void {
  const bytes = utf8.encode(value);
  varint(out, BigInt((field << 3) | 2));
  varint(out, BigInt(bytes.length));
  out.push(...bytes);
}

function uintField(out: number[], field: number, value: bigint): void {
  varint(out, BigInt(field << 3));
  varint(out, value);
}

export interface WindowRequest {
  /** The `qor1…` account that signs, which is also the account the window opens for. */
  sender: string;
  /** The only contract the window may call. */
  target: string;
}

/**
 * `MsgOpenEVMWindow` scoped to one contract, sized from config/app.json. Field numbers follow
 * `qorechain.pqc.v1.MsgOpenEVMWindow` (sender 1, blocks 2, max_txs 3, max_value 4, native_only 5, allowed_targets 6);
 * default values are left out, as protobuf does.
 */
export function openWindowMessage({ sender, target }: WindowRequest): EncodedMessage {
  if (!sender.startsWith('qor1')) throw new Error(`Not a QoreChain account: ${sender}`);
  toEvmAddress(sender); // throws on a bad bech32 checksum
  const a = config.anchor;
  const maxValue = evmWindowCost({ gas: BigInt(a.gasLimit), maxFeePerGas: BigInt(a.maxFeePerGasWei) }) * BigInt(a.windowMaxTxs);
  const v = checkOpenEvmWindowParams({
    sender,
    blocks: a.windowBlocks,
    maxTxs: a.windowMaxTxs,
    maxValue,
    allowedTargets: [target.toLowerCase()],
  });
  const out: number[] = [];
  if (v.sender !== '') stringField(out, 1, v.sender);
  if (v.blocks !== '0') uintField(out, 2, BigInt(v.blocks));
  if (v.maxTxs !== '0') uintField(out, 3, BigInt(v.maxTxs));
  if (v.maxValue !== '') stringField(out, 4, v.maxValue);
  if (v.nativeOnly) uintField(out, 5, 1n);
  for (const t of v.allowedTargets) stringField(out, 6, t);
  return { typeUrl: OPEN_EVM_WINDOW_TYPE_URL, value: Uint8Array.from(out) };
}
