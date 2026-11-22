import { toEvmAddress } from '@qorechain/evm/window';
import { getQorexNative, qorexSignAndBroadcast, QorexIntegrationError, QOREX_NOT_INSTALLED_MESSAGE } from '@qorechain/qorex-types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import type { ReportDigest } from '@sisir/report';
import { config } from '../config.js';
import { appChainId } from '../wagmi.js';
import { classifyAnchorError, type AnchorErrorKind } from './errors.js';
import { sisirLedgerAbi } from './ledger.js';
import { openWindowMessage } from './windowMessage.js';

export interface WindowReceipt {
  txHash: string;
  height?: number;
  /** QoreX's own reading of the committed transaction: `shielded` means the ML-DSA-87 layer is in it. */
  shield: string;
  /** The 0x form of the account the window opened for. */
  account: string;
}

export interface AnchorReceipt {
  txHash: `0x${string}`;
  blockNumber: bigint;
  reportHash: string;
}

export type StepState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; receipt: T }
  | { status: 'error'; kind: AnchorErrorKind; detail?: string };

/** The two transactions of "Anchor this report": the hybrid-signed window, then the ledger call. */
export function useAnchor(digest: ReportDigest | null, ledger: `0x${string}` | null) {
  const [windowStep, setWindowStep] = useState<StepState<WindowReceipt>>({ status: 'idle' });
  const [anchorStep, setAnchorStep] = useState<StepState<AnchorReceipt>>({ status: 'idle' });
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: appChainId });
  const queries = useQueryClient();

  // A different report needs its own anchor; the window stays open for it.
  const reportHash = digest?.reportHash ?? null;
  useEffect(() => {
    setAnchorStep((s) => (s.status === 'done' && s.receipt.reportHash === reportHash ? s : { status: 'idle' }));
  }, [reportHash]);

  const openWindow = useCallback(async () => {
    if (!ledger) return;
    setWindowStep({ status: 'pending' });
    try {
      const native = getQorexNative();
      if (!native) throw new QorexIntegrationError('QOREX_NOT_INSTALLED', QOREX_NOT_INSTALLED_MESSAGE);
      const chainId = config.chain.nativeId;
      await native.enable(chainId);
      const { bech32Address } = await native.getKey(chainId);
      const message = openWindowMessage({ sender: bech32Address, target: ledger });
      const result = await qorexSignAndBroadcast({
        chainId,
        messages: [message],
        gasLimit: config.anchor.nativeGasLimit,
      });
      if (result.code !== 0) {
        setWindowStep({ status: 'error', kind: 'chainRefused', detail: `code ${result.code}, ${result.txHash}` });
        return;
      }
      setWindowStep({
        status: 'done',
        receipt: {
          txHash: result.txHash,
          ...(result.height !== undefined ? { height: result.height } : {}),
          shield: result.shield,
          account: toEvmAddress(bech32Address),
        },
      });
    } catch (error) {
      setWindowStep({ status: 'error', kind: classifyAnchorError(error) });
    }
  }, [ledger]);

  const anchor = useCallback(async () => {
    if (!ledger || !digest || !client) return;
    setAnchorStep({ status: 'pending' });
    try {
      const txHash = await writeContractAsync({
        address: ledger,
        abi: sisirLedgerAbi,
        functionName: 'anchor',
        args: [digest.reportHash, digest.sourceHash, digest.findings],
        chainId: appChainId,
        gas: BigInt(config.anchor.gasLimit),
      });
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        setAnchorStep({ status: 'error', kind: 'chainRefused', detail: txHash });
        return;
      }
      setAnchorStep({ status: 'done', receipt: { txHash, blockNumber: receipt.blockNumber, reportHash: digest.reportHash } });
      await queries.invalidateQueries();
    } catch (error) {
      setAnchorStep({ status: 'error', kind: classifyAnchorError(error) });
    }
  }, [client, digest, ledger, queries, writeContractAsync]);

  return { windowStep, anchorStep, openWindow, anchor };
}
