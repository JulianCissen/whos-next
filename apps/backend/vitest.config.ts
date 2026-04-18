import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/*.integration.spec.ts', '**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@whos-next/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
