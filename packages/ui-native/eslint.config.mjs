import { ui } from '@agarha/config/eslint';

export default [...ui, { ignores: ['*.config.js', 'tailwind-preset.js', 'babel.config.js'] }, { files: ['**/*.stories.tsx', '**/*.test.tsx'], rules: { 'agarha/no-jsx-literal': 'off' } }];
