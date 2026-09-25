import { ui } from '@agarha/config/eslint';

export default [
  ...ui,
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  { files: ['e2e/**'], rules: { 'agarha/no-jsx-literal': 'off' } },
];
