import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Parsing every fixture takes a few seconds on a busy CI runner; 5 s (the default) is too tight.
    testTimeout: 30_000,
  },
});
