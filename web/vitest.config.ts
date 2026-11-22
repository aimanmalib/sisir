import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { alias } from "./vite.config.js";

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    // Parsing a contract in jsdom is slow on a busy CI runner.
    testTimeout: 30_000,
  },
});
