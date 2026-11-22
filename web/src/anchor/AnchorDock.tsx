import '@rainbow-me/rainbowkit/styles.css';
import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import type { ReportDigest } from '@sisir/report';
import { AnchorPanel } from '../components/AnchorPanel.js';
import { RecentAnchors } from '../components/RecentAnchors.js';
import { useI18n } from '../i18n/i18n.js';
import { config as wagmiConfig } from '../wagmi.js';
import { ledgerAddress } from './ledger.js';

export interface AnchorDockProps {
  digest: ReportDigest | null;
  fileName: string;
  /** Why there is no digest: nothing to inspect, or a source that does not parse. */
  reason: 'empty' | 'parse' | null;
}

/** RainbowKit takes colours as strings; read them from the design tokens in tokens.css. */
function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Everything that talks to a wallet or the chain. Loaded on its own, after the inspector, so the
 * rule engine paints first and wagmi and RainbowKit arrive in a separate chunk.
 */
export default function AnchorDock(props: AnchorDockProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [theme] = useState(() =>
    darkTheme({ accentColor: token('--manila', 'goldenrod'), accentColorForeground: token('--manila-ink', 'black'), borderRadius: 'small' }),
  );
  const { lang } = useI18n();
  const ledger = ledgerAddress();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} locale={lang === 'ms' ? 'ms-MY' : 'en-US'}>
          <div className="ledger__grid">
            <AnchorPanel {...props} ledger={ledger} />
            <RecentAnchors ledger={ledger} />
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
