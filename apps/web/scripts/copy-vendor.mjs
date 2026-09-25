// maplibre-gl 6 runs its tile parser in a module worker loaded by URL. Bundlers rename the main
// chunk, so the worker (and the shared chunk it imports) are served as static files instead.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(
  join(import.meta.dirname, '..', '..', '..', 'packages', 'ui-web', 'package.json'),
);
const dist = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist');
const out = join(import.meta.dirname, '..', 'public', 'vendor', 'maplibre');
mkdirSync(out, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])
  copyFileSync(join(dist, f), join(out, f));
console.log(`maplibre worker → ${out}`);
