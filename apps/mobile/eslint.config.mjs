import { ui } from '@agarha/config/eslint';

export default [
  ...ui,
  {
    ignores: [
      '*.config.js',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      '.rnstorybook/storybook.requires.ts',
      '.maestro/**',
    ],
  },
  { files: ['**/*.test.tsx', '**/*.test.ts'], rules: { 'agarha/no-jsx-literal': 'off' } },
];
