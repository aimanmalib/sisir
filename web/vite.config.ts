import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The public REST APIs send no CORS headers, so the browser reaches them
// through the dev (and preview) server: /lcd-testnet and /lcd-mainnet are
// forwarded to each network's REST endpoint (see REST_PROXY in src/App.tsx).
// In production, serve the app behind a proxy that does the same.
const rest = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/lcd-(testnet|mainnet)/, ""),
});
const proxy = {
  "/lcd-testnet": rest("https://api-testnet.qore.host"),
  "/lcd-mainnet": rest("https://api.qore.host"),
};

// The playground runs the CLI's own rule engine: @sisir/rules is ../src/rules, not a copy.
// The example contracts and config/app.json are read from the repository root as well.
// @sisir/report is the CLI's report hash, so an anchor from the browser matches one from the terminal.
export const alias = {
  "@sisir/rules": fileURLToPath(new URL("../src/rules/index.ts", import.meta.url)),
  "@sisir/report": fileURLToPath(new URL("../src/report/hash.ts", import.meta.url)),
};
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  build: { target: "es2022" },
  server: { port: 5173, proxy, fs: { allow: [repoRoot] } },
  preview: { proxy },
});
