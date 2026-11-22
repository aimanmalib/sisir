/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_SISIR_LEDGER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
