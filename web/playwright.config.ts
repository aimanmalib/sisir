import { defineConfig, devices } from "@playwright/test";
import { E2E_LEDGER } from "./e2e/fake-chain.js";

// The anchor flow against the QoreX test double (@qorechain/qorex-wallet-mock) and a fake chain the tests
// answer themselves, so the suite never touches the real testnet. Visual checks on WebKit live elsewhere.
const PORT = 4317;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx --no-install vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SISIR_LEDGER: E2E_LEDGER },
  },
});
