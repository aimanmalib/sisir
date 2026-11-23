import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Deriving ML-DSA-87 keys and signing take a few seconds on a busy CI runner.
    testTimeout: 30_000,
  },
});
