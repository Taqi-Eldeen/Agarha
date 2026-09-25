import { defineConfig } from 'tsup';

// Subpath entries without Zod (enums, phone, arabic, freshness) keep browser bundles small.
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/enums.ts',
    'src/phone.ts',
    'src/arabic.ts',
    'src/freshness.ts',
    'src/price.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
});
