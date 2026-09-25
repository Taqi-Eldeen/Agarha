// Performance budget (section 11): initial JS per route, gzipped, from the Next build manifests.
// Run after `next build`: node scripts/check-budget.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const NEXT = join(import.meta.dirname, '..', '.next');
const BUDGETS_KB = {
  '/[locale]/(site)/cars/[idSlug]/page': 170, // listing page: < 170 KB (spec)
  '/[locale]/(site)/page': 170,
  '/[locale]/(site)/search/page': 200,
  '/[locale]/(site)/[city]/page': 170,
};

const build = JSON.parse(readFileSync(join(NEXT, 'build-manifest.json'), 'utf8'));
const app = JSON.parse(readFileSync(join(NEXT, 'app-build-manifest.json'), 'utf8'));
const sizeCache = new Map();
const gz = (f) => {
  if (!sizeCache.has(f)) sizeCache.set(f, gzipSync(readFileSync(join(NEXT, f)), { level: 9 }).length);
  return sizeCache.get(f);
};

let failed = false;
for (const [route, budget] of Object.entries(BUDGETS_KB)) {
  const files = new Set([...build.rootMainFiles, ...(app.pages[route] ?? [])].filter((f) => f.endsWith('.js')));
  if (!app.pages[route]) {
    console.error(`✗ ${route}: not in the build`);
    failed = true;
    continue;
  }
  const kb = [...files].reduce((n, f) => n + gz(f), 0) / 1024;
  const ok = kb <= budget;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${route}: ${kb.toFixed(1)} KB gzipped JS (budget ${budget} KB)`);
}
process.exit(failed ? 1 : 0);
