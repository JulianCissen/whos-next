import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.spec.ts'],
    globalSetup: './src/test/global-setup.ts',
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@whos-next/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
