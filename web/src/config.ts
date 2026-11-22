import raw from '../../config/app.json';

export interface Sample {
  id: string;
  /** Path from the repository root, as listed in config/app.json. */
  file: string;
}

export interface AppConfig {
  chain: { id: number; name: string; evmRpc: string };
  contracts: { sisirLedger: string };
  links: { repo: string; rules: string };
  playground: { lintDelayMs: number; maxSourceBytes: number; defaultLanguage: string; samples: Sample[] };
}

/** Every value the playground may change without touching code. Read from config/app.json at build time. */
export const config: AppConfig = raw;
