// @ts-check
import tseslint from 'typescript-eslint';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-plugin-prettier/recommended';
import packageJsonPlugin from 'eslint-plugin-package-json';
import * as jsoncParser from 'jsonc-eslint-parser';
import angular from 'angular-eslint';

export default tseslint.config(
  // 1. Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.angular/**',
      '**/*.d.ts',
      '**/*.js.map',
      '**/*.bru',
    ],
  },

  // 2. TypeScript base — type-aware linting for all TS files
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'apps/backend/vitest.config.ts',
            'apps/backend/vitest.integration.config.ts',
            'apps/frontend/vitest.config.ts',
            'apps/e2e/playwright.config.ts',
            'apps/e2e/tests/*.spec.ts',
            'apps/backend/src/*/*.spec.ts',
            'apps/backend/src/*/*/*.spec.ts',
          ],
          defaultProject: 'tsconfig.base.json',
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
        },
      },
    },
    rules: {
      // Async safety
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      // Unsafe patterns — warn to allow gradual adoption
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      // Modern idioms
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      // General quality
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'max-lines': ['error', { max: 300 }],
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // 3. import-x — import ordering and resolution
  {
    files: ['**/*.ts'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@whos-next/*', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: [],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': 'warn',
      'import-x/no-unresolved': 'error',
      'import-x/no-extraneous-dependencies': 'error',
    },
  },

  // 4. Unicorn — opinionated JS/TS best practices
  {
    files: ['**/*.ts'],
    plugins: { unicorn },
    rules: {
      ...unicorn.configs.recommended.rules,
      'unicorn/prefer-module': 'off', // NestJS targets CommonJS
      'unicorn/no-null': 'off', // Angular Material, MikroORM, RxJS use null
      'unicorn/prevent-abbreviations': 'off', // req, res, ctx, dto, ref are standard
      'unicorn/no-array-for-each': 'off', // RxJS subscribe/pipe false positives
      'unicorn/no-array-reduce': 'off', // Legitimate in data pipelines and RxJS
      'unicorn/filename-case': 'off', // Mixed conventions across frameworks
      'unicorn/import-style': 'off', // Conflicts with import-x ordering
      'unicorn/no-array-callback-reference': 'off', // ORM .find()/.filter() false positives
      'unicorn/no-array-method-this-argument': 'off', // Same as above
      'unicorn/consistent-function-scoping': 'off', // Angular signal patterns (computed, effect)
      'unicorn/prefer-top-level-await': 'off', // CommonJS modules don't support top-level await
    },
  },

  // 5. Angular — scoped to frontend source only
  {
    files: ['apps/frontend/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // Angular validators use unbound static methods — this is intentional
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['apps/frontend/src/**/*.html'],
    extends: [...angular.configs.templateRecommended],
  },

  // 6. File-category overrides
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['**/apps/e2e/**/*.ts', '**/*.e2e.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['**/seeders/**/*.ts', '**/fixtures/**/*.ts'],
    rules: {
      'max-lines': 'off',
    },
  },

  // 7. JSON — register parser so Prettier can format .json files
  {
    files: ['**/*.json'],
    languageOptions: { parser: jsoncParser },
  },

  // 8. package-json
  packageJsonPlugin.configs.recommended,
  packageJsonPlugin.configs.stylistic,

  // 9. Prettier — MUST be last
  prettierConfig,

  // 10. Angular HTML templates — disable prettier/prettier (Angular template parser conflicts)
  {
    files: ['**/*.html'],
    rules: { 'prettier/prettier': 'off' },
  },
);
