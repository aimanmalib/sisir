import raw from '../../config/app.json';

export interface Sample {
  id: string;
  /** Path from the repository root, as listed in config/app.json. */
  file: string;
}

export interface AppConfig {
  chain: { id: number; name: string; evmRpc: string; nativeId: string };
  contracts: { sisirLedger: string };
  links: { repo: string; rules: string };
  playground: { lintDelayMs: number; maxSourceBytes: number; defaultLanguage: string; samples: Sample[] };
  /** How the playground opens an EVM window and anchors a report. Gas values are for one `anchor` call. */
  anchor: {
    windowBlocks: number;
    windowMaxTxs: number;
    gasLimit: number;
    maxFeePerGasWei: string;
    /** Gas hint for the native window transaction; QoreX clamps it to 100,000 to 5,000,000. */
    nativeGasLimit: number;
    recentLimit: number;
  };
}

/** Every value the playground may change without touching code. Read from config/app.json at build time. */
export const config: AppConfig = raw;
