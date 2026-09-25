import { ui } from '@agarha/config/eslint';

export default [...ui, { ignores: ['storybook-static/**'] }, { files: ['**/*.stories.tsx', '**/*.test.tsx'], rules: { 'agarha/no-jsx-literal': 'off' } }];
