import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import agarha from './plugin.js';

/**
 * Import boundaries (section 5):
 * - packages never import apps
 * - nothing reaches into another workspace's src/ internals
 */
const boundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: [
            '**/apps/*',
            '@agarha/web',
            '@agarha/admin',
            '@agarha/mobile',
            '@agarha/api',
            '@agarha/worker',
          ],
          message: 'Packages and apps must not import apps.',
        },
        {
          group: ['@agarha/*/src/*'],
          message: 'Import the package entry point, not its internals.',
        },
      ],
    },
  ],
};

/** Base config for every TypeScript workspace. */
export const base = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-tools/**',
      '**/coverage-integration/**',
      '**/storybook-static/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.next/**',
      '**/.expo/**',
      '**/build/**',
      '**/coverage/**',
      '**/drizzle/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      ...boundaryRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  prettier,
);

/** Adds RTL and i18n rules for anything that renders UI. */
export const ui = tseslint.config(...base, {
  files: ['**/*.tsx', '**/*.jsx'],
  languageOptions: { globals: { ...globals.browser } },
  plugins: { agarha, 'react-hooks': reactHooks },
  rules: {
    'agarha/no-physical-direction': 'error',
    'agarha/no-jsx-literal': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
});

/**
 * NestJS API: modules talk through each other's public index (service interface + events),
 * never through another module's tables, repositories or internals.
 */
export const api = tseslint.config(
  ...base,
  // Nest DI reads constructor parameter types from decorator metadata: keep those imports as values.
  {
    languageOptions: {
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...boundaryRules['no-restricted-imports'][1].patterns,
            {
              regex: '^\\.\\./(?!\\.)[^/]+/(?!index$).+',
              message: 'Import another module only through its index.ts public API.',
            },
          ],
        },
      ],
    },
  },
);

export default base;

/** For service workers (e.g. apps/web/public/sw.js). */
export const serviceWorkerGlobals = { languageOptions: { globals: globals.serviceworker } };
