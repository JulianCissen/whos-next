import { resolve } from 'node:path';

import angular from '@analogjs/vitest-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/*.integration.spec.ts', '**/node_modules/**', '**/dist/**'],
    setupFiles: ['src/test-setup.ts'],
    server: {
      deps: {
        inline: [/^@angular/, /^@angular\/material/, /^@ngx-translate/, /^@whos-next/],
      },
    },
  },
  resolve: {
    alias: {
      '@whos-next/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
