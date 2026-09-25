import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/msw.ts'],
  external: ['msw'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
});
