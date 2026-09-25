import { api } from '@agarha/config/eslint';
import { readdirSync } from 'node:fs';

// Table ownership: a module may import only its own schema file from src/db/schema.
const modules = readdirSync(new URL('./src/modules', import.meta.url));
const ownership = modules.map((m) => ({
  files: [`src/modules/${m}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { regex: '^\\.\\./(?!\\.)[^/]+/(?!index$).+', message: 'Import another module only through its index.ts public API.' },
          { group: ['**/db/schema/*', `!**/db/schema/${m}`, '!**/db/schema/enums', '!**/db/schema/_columns'], message: `Module "${m}" may only query its own tables.` },
        ],
      },
    ],
  },
}));

export default [...api, ...ownership, { ignores: ['drizzle/**', 'dist/**', '*.config.js', '*.config.mjs'] }];
