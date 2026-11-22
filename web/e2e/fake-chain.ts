import type { Page, Route } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  keccak256,
  parseTransaction,
  recoverTransactionAddress,
  toHex,
  type Hex,
  type TransactionSerialized,
} from "viem";
import { sisirLedgerAbi } from "../src/anchor/abi.js";

/** The ledger address the e2e build points at (VITE_SISIR_LEDGER). Nothing is deployed there: the fake answers. */
export const E2E_LEDGER = "0x00000000000000000000000000000000005151a1";

const EVM = "https://evm-testnet.qore.host";
const REST = "https://api-testnet.qore.host";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };

interface StoredAnchor {
  account: Hex;
  reportHash: Hex;
  sourceHash: Hex;
  findings: number;
  blockNumber: bigint;
  timestamp: bigint;
}

/** What the page sent, for the test to check. */
export interface FakeChain {
  /** Native transactions broadcast through REST, as raw bytes. */
  nativeTxs: Uint8Array[];
  /** Anchors the ledger accepted, oldest first. */
  anchors: StoredAnchor[];
  /** JSON-RPC methods the fake did not know. */
  unknown: string[];
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** Answers the testnet REST and EVM endpoints inside the browser, so the anchor flow runs offline. */
export async function installFakeChain(page: Page): Promise<FakeChain> {
  const chain: FakeChain = { nativeTxs: [], anchors: [], unknown: [] };
  let block = 1000n;
  const receipts = new Map<Hex, { block: bigint; from: Hex }>();

  await page.route(`${REST}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    if (path.startsWith("/qorechain/pqc/v1/account/")) return json(route, { found: false }, 404);
    if (path.startsWith("/cosmos/auth/v1beta1/account_info/")) return json(route, { info: { account_number: "42", sequence: String(chain.nativeTxs.length) } });
    if (path.startsWith("/cosmos/upgrade/v1beta1/applied_plan/")) return json(route, { height: "0" });
    if (path === "/cosmos/tx/v1beta1/txs" && req.method() === "POST") {
      const bytes = Buffer.from((req.postDataJSON() as { tx_bytes: string }).tx_bytes, "base64");
      chain.nativeTxs.push(new Uint8Array(bytes));
      return json(route, { tx_response: { code: 0, codespace: "", raw_log: "", txhash: keccak256(bytes).slice(2).toUpperCase() } });
    }
    if (path.startsWith("/cosmos/tx/v1beta1/txs/")) {
      block += 1n;
      return json(route, {
        tx_response: { code: 0, height: String(block) },
        tx: { body: { extension_options: [{ "@type": "/qorechain.pqc.v1.PQCHybridSignature" }] } },
      });
    }
    return json(route, { code: 5, message: `fake chain: no answer for ${path}` }, 404);
  });

  async function answer(method: string, params: unknown[]): Promise<unknown> {
    switch (method) {
      case "eth_chainId":
        return "0x2648";
      case "eth_blockNumber":
        return toHex(block);
      case "eth_gasPrice":
        return toHex(112_500_000_000n);
      case "eth_getBalance":
        // RainbowKit shows the connected account's balance: 10 test QOR.
        return toHex(10n * 10n ** 18n);
      case "eth_maxPriorityFeePerGas":
        return "0x0";
      case "eth_getBlockByNumber":
        return {
          number: toHex(block),
          hash: keccak256(toHex(block)),
          parentHash: keccak256(toHex(block - 1n)),
          timestamp: toHex(1_764_000_000n),
          baseFeePerGas: toHex(100_000_000_000n),
          gasLimit: "0x1c9c380",
          gasUsed: "0x0",
          miner: E2E_LEDGER,
          transactions: [],
        };
      case "eth_feeHistory":
        return { oldestBlock: toHex(block), baseFeePerGas: [toHex(100_000_000_000n), toHex(100_000_000_000n)], gasUsedRatio: [0], reward: [["0x0"]] };
      case "eth_estimateGas":
        return toHex(180_000n);
      case "eth_getTransactionCount":
        return toHex(chain.nativeTxs.length);
      case "eth_call": {
        const { data } = params[0] as { data: Hex };
        const call = decodeFunctionData({ abi: sisirLedgerAbi, data });
        if (call.functionName !== "latest") throw new Error(`fake chain: eth_call ${call.functionName}`);
        const list = [...chain.anchors].reverse().slice(0, Number(call.args[0]));
        return encodeFunctionResult({ abi: sisirLedgerAbi, functionName: "latest", result: list });
      }
      case "eth_sendRawTransaction": {
        const raw = params[0] as TransactionSerialized;
        const tx = parseTransaction(raw);
        const from = await recoverTransactionAddress({ serializedTransaction: raw });
        const call = decodeFunctionData({ abi: sisirLedgerAbi, data: tx.data ?? "0x" });
        if (call.functionName !== "anchor" || tx.to?.toLowerCase() !== E2E_LEDGER) throw new Error("fake chain: unexpected transaction");
        block += 1n;
        const [reportHash, sourceHash, findings] = call.args;
        chain.anchors.push({ account: from, reportHash, sourceHash, findings, blockNumber: block, timestamp: 1_764_000_000n });
        const hash = keccak256(raw);
        receipts.set(hash, { block, from });
        return hash;
      }
      case "eth_getTransactionReceipt": {
        const hash = params[0] as Hex;
        const r = receipts.get(hash);
        if (!r) return null;
        return {
          transactionHash: hash,
          transactionIndex: "0x0",
          blockHash: keccak256(toHex(r.block)),
          blockNumber: toHex(r.block),
          from: r.from,
          to: E2E_LEDGER,
          cumulativeGasUsed: "0x2bf20",
          gasUsed: "0x2bf20",
          effectiveGasPrice: toHex(112_500_000_000n),
          contractAddress: null,
          logs: [],
          logsBloom: `0x${"00".repeat(256)}`,
          status: "0x1",
          type: "0x0",
        };
      }
      default:
        chain.unknown.push(method);
        throw Object.assign(new Error(`fake chain: ${method} not answered`), { code: -32601 });
    }
  }

  await page.route(`${EVM}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = req.postDataJSON() as { id: number; method: string; params?: unknown[] } | { id: number; method: string; params?: unknown[] }[];
    const one = async (r: { id: number; method: string; params?: unknown[] }) => {
      try {
        return { jsonrpc: "2.0", id: r.id, result: await answer(r.method, r.params ?? []) };
      } catch (e) {
        return { jsonrpc: "2.0", id: r.id, error: { code: (e as { code?: number }).code ?? -32000, message: (e as Error).message } };
      }
    };
    return json(route, Array.isArray(body) ? await Promise.all(body.map(one)) : await one(body));
  });

  return chain;
}
