import { ui } from '@agarha/config/eslint';

export default [...ui, { ignores: ['storybook-static/**', 'tailwind.config.cjs'] }, { files: ['**/*.stories.tsx', '**/*.test.tsx'], rules: { 'agarha/no-jsx-literal': 'off' } }];
