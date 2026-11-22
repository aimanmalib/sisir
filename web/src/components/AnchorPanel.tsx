import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import type { AnchorDockProps } from '../anchor/AnchorDock.js';
import { useAnchor, type StepState } from '../anchor/useAnchor.js';
import { config } from '../config.js';
import { useI18n } from '../i18n/i18n.js';

/** 0x1234…cdef: enough to recognise, with the full value in the title and the copy button. */
export function short(hex: string): string {
  return hex.length > 14 ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : hex;
}

function HashRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => setCopied(true));
  };
  return (
    <div className="slip__row">
      <dt>{label}</dt>
      <dd>
        <code title={value}>{short(value)}</code>
        <button type="button" className="slip__copy" onClick={copy} aria-label={`${t('anchor.copy')}: ${label}`}>
          {copied ? t('anchor.copied') : t('anchor.copy')}
        </button>
      </dd>
    </div>
  );
}

function Step({ n, title, hint, state, children }: { n: number; title: string; hint: string; state: 'todo' | 'now' | 'done'; children?: ReactNode }) {
  return (
    <li className="step" data-state={state}>
      <span className="step__n" aria-hidden="true">
        {n}
      </span>
      <div className="step__body">
        <h4 className="step__title">{title}</h4>
        <p className="step__hint">{hint}</p>
        {children}
      </div>
    </li>
  );
}

function StepError({ step }: { step: StepState<unknown> }) {
  const { t } = useI18n();
  if (step.status !== 'error') return null;
  return (
    <p className="step__error" role="alert">
      {t(`anchor.error.${step.kind}`, { detail: step.detail ?? '' })}
    </p>
  );
}

/** "Anchor this report": the report slip, then connect, open a window, anchor. */
export function AnchorPanel({ digest, fileName, reason, ledger }: AnchorDockProps & { ledger: `0x${string}` | null }) {
  const { t } = useI18n();
  const { isConnected, chainId } = useAccount();
  const { windowStep, anchorStep, openWindow, anchor } = useAnchor(digest, ledger);
  const onChain = isConnected && chainId === config.chain.id;
  const live = ledger !== null && digest !== null;
  const windowDone = windowStep.status === 'done';
  const a = config.anchor;

  return (
    <section className="anchor" aria-labelledby="anchor-title">
      <h3 id="anchor-title" className="anchor__title">
        {t('anchor.heading')}
      </h3>
      <p className="anchor__intro">{t('anchor.intro')}</p>
      {digest ? (
        <dl className="slip">
          <div className="slip__row">
            <dt>{t('anchor.file')}</dt>
            <dd>{fileName}</dd>
          </div>
          <HashRow label={t('anchor.report')} value={digest.reportHash} />
          <HashRow label={t('anchor.source')} value={digest.sourceHash} />
          <div className="slip__row">
            <dt>{t('anchor.findings')}</dt>
            <dd>{digest.findings}</dd>
          </div>
        </dl>
      ) : (
        <p className="anchor__note">{t(reason === 'parse' ? 'anchor.parse' : 'anchor.empty')}</p>
      )}
      {ledger === null ? <p className="anchor__note">{t('anchor.noLedger')}</p> : null}
      <ol className="steps" data-live={live || undefined}>
        <Step n={1} title={t('anchor.step1')} hint={t('anchor.step1Hint')} state={onChain ? 'done' : 'now'}>
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
              if (!mounted) return null;
              if (!account)
                return (
                  <button type="button" className="btn btn--primary" onClick={openConnectModal} disabled={!live}>
                    {t('anchor.connect')}
                  </button>
                );
              if (chain?.unsupported || chain?.id !== config.chain.id)
                return (
                  <button type="button" className="btn" onClick={openChainModal}>
                    {t('anchor.wrongNetwork')}
                  </button>
                );
              return (
                <button type="button" className="btn btn--quiet" onClick={openAccountModal}>
                  {t('anchor.account', { address: account.displayName })}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </Step>
        <Step
          n={2}
          title={t('anchor.step2')}
          hint={t('anchor.step2Hint', { txs: a.windowMaxTxs, blocks: a.windowBlocks })}
          state={windowDone ? 'done' : onChain ? 'now' : 'todo'}
        >
          <button type="button" className="btn btn--primary" onClick={() => void openWindow()} disabled={!live || !onChain || windowStep.status === 'pending'}>
            {windowStep.status === 'pending' ? t('anchor.opening') : t('anchor.open')}
          </button>
          {windowStep.status === 'done' ? (
            <p className="step__ok" role="status">
              {t('anchor.windowOpen', { account: short(windowStep.receipt.account) })}{' '}
              {t('anchor.shieldLabel', { state: t(`anchor.shield.${windowStep.receipt.shield}`) })}{' '}
              <code title={windowStep.receipt.txHash}>{t('anchor.tx', { hash: short(windowStep.receipt.txHash) })}</code>
            </p>
          ) : null}
          <StepError step={windowStep} />
        </Step>
        <Step n={3} title={t('anchor.step3')} hint={t('anchor.step3Hint')} state={anchorStep.status === 'done' ? 'done' : windowDone ? 'now' : 'todo'}>
          <button type="button" className="btn btn--primary" onClick={() => void anchor()} disabled={!live || !onChain || !windowDone || anchorStep.status === 'pending'}>
            {anchorStep.status === 'pending' ? t('anchor.sending') : t('anchor.send')}
          </button>
          {anchorStep.status === 'done' ? (
            <p className="step__ok" role="status">
              {t('anchor.anchored', { block: anchorStep.receipt.blockNumber.toString() })}{' '}
              <code title={anchorStep.receipt.txHash}>{t('anchor.tx', { hash: short(anchorStep.receipt.txHash) })}</code>
            </p>
          ) : null}
          <StepError step={anchorStep} />
        </Step>
      </ol>
    </section>
  );
}
