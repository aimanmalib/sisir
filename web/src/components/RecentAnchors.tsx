import { useReadContract } from 'wagmi';
import { sisirLedgerAbi } from '../anchor/ledger.js';
import { config } from '../config.js';
import { appChainId } from '../wagmi.js';
import { useI18n } from '../i18n/i18n.js';
import { short } from './AnchorPanel.js';

/** The newest anchors, read from the ledger over the public EVM RPC. No wallet needed. */
export function RecentAnchors({ ledger }: { ledger: `0x${string}` | null }) {
  const { t, lang } = useI18n();
  const { data, isPending, isError } = useReadContract({
    address: ledger ?? undefined,
    abi: sisirLedgerAbi,
    functionName: 'latest',
    args: [BigInt(config.anchor.recentLimit)],
    chainId: appChainId,
    query: { enabled: ledger !== null },
  });
  const date = new Intl.DateTimeFormat(lang === 'ms' ? 'ms-MY' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  let body;
  if (ledger === null) body = <p className="recent__note">{t('anchor.recentEmpty')}</p>;
  else if (isError) body = <p className="recent__note">{t('anchor.recentError')}</p>;
  else if (isPending) body = <p className="recent__note">{t('anchor.recentLoading')}</p>;
  else if (data.length === 0) body = <p className="recent__note">{t('anchor.recentEmpty')}</p>;
  else
    body = (
      <ol className="recent__list">
        {data.map((a) => (
          <li key={`${a.blockNumber}-${a.reportHash}`} className="recent__item">
            <code className="recent__hash" title={a.reportHash}>
              {short(a.reportHash)}
            </code>
            <span className="recent__meta">
              <span title={a.account}>
                {t('anchor.col.account')} {short(a.account)}
              </span>
              <span>
                {t('anchor.col.findings')} {a.findings}
              </span>
              <span>
                {t('anchor.col.block')} {a.blockNumber.toString()}
              </span>
            </span>
            <time className="recent__time" dateTime={new Date(Number(a.timestamp) * 1000).toISOString()}>
              {date.format(new Date(Number(a.timestamp) * 1000))}
            </time>
          </li>
        ))}
      </ol>
    );

  return (
    <section className="recent" aria-labelledby="recent-title">
      <h3 id="recent-title" className="anchor__title">
        {t('anchor.recent')}
      </h3>
      {body}
    </section>
  );
}
