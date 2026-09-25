#!/usr/bin/env node
// Contract test (section 10): no breaking /v1 change without a version bump.
//   node scripts/openapi-diff.mjs <base.json> <head.json>
// Breaking = a removed operation, a removed response field, a new required request field, a
// removed enum value, a request field whose type changed, or a newly required query parameter.
import { readFileSync } from 'node:fs';

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error('usage: openapi-diff.mjs <base.json> <head.json>');
  process.exit(2);
}
const base = JSON.parse(readFileSync(basePath, 'utf8'));
const head = JSON.parse(readFileSync(headPath, 'utf8'));
const problems = [];
const METHODS = ['get', 'put', 'post', 'patch', 'delete'];

const deref = (doc, s) => {
  let seen = 0;
  while (s && s.$ref && seen++ < 20)
    s = s.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((o, k) => o?.[k], doc);
  return s ?? {};
};
const typeOf = (s) =>
  s.type
    ? [].concat(s.type).sort().join('|')
    : s.enum
      ? 'enum'
      : s.anyOf || s.oneOf
        ? 'union'
        : 'object';

/** Walk two schemas; `dir` = 'response' (fields must not disappear) or 'request' (no new requirements). */
function compare(bDoc, b, hDoc, h, where, dir) {
  b = deref(bDoc, b);
  h = deref(hDoc, h);
  if (b.enum && h.enum) {
    for (const v of b.enum)
      if (!h.enum.includes(v)) problems.push(`${where}: enum value ${JSON.stringify(v)} removed`);
  }
  if (dir === 'request' && b.type && h.type && typeOf(b) !== typeOf(h))
    problems.push(`${where}: type changed ${typeOf(b)} → ${typeOf(h)}`);
  const bp = b.properties ?? {};
  const hp = h.properties ?? {};
  if (dir === 'response') {
    for (const k of Object.keys(bp)) {
      if (!(k in hp)) problems.push(`${where}.${k}: response field removed`);
      else compare(bDoc, bp[k], hDoc, hp[k], `${where}.${k}`, dir);
    }
  } else {
    const bReq = new Set(b.required ?? []);
    for (const k of h.required ?? [])
      if (!bReq.has(k)) problems.push(`${where}.${k}: newly required request field`);
    for (const k of Object.keys(bp))
      if (k in hp) compare(bDoc, bp[k], hDoc, hp[k], `${where}.${k}`, dir);
  }
  if (b.items && h.items) compare(bDoc, b.items, hDoc, h.items, `${where}[]`, dir);
}

for (const [path, bOps] of Object.entries(base.paths ?? {})) {
  const hOps = head.paths?.[path];
  for (const m of METHODS) {
    const bo = bOps[m];
    if (!bo) continue;
    const ho = hOps?.[m];
    const op = `${m.toUpperCase()} ${path}`;
    if (!ho) {
      problems.push(`${op}: operation removed`);
      continue;
    }
    const bBody = bo.requestBody?.content?.['application/json']?.schema;
    const hBody = ho.requestBody?.content?.['application/json']?.schema;
    if (hBody && !bBody && ho.requestBody?.required)
      problems.push(`${op}: request body became required`);
    if (bBody && hBody) compare(base, bBody, head, hBody, `${op} body`, 'request');
    const bParams = new Map((bo.parameters ?? []).map((p) => [`${p.in}:${p.name}`, p]));
    for (const p of ho.parameters ?? [])
      if (p.required && !bParams.get(`${p.in}:${p.name}`)?.required)
        problems.push(`${op}: parameter ${p.in}:${p.name} is newly required`);
    for (const [code, bRes] of Object.entries(bo.responses ?? {})) {
      if (!code.startsWith('2')) continue;
      const hRes = ho.responses?.[code];
      if (!hRes) {
        problems.push(`${op}: ${code} response removed`);
        continue;
      }
      const bs = bRes.content?.['application/json']?.schema;
      const hs = hRes.content?.['application/json']?.schema;
      if (bs && hs) compare(base, bs, head, hs, `${op} ${code}`, 'response');
    }
  }
}

const added = Object.keys(head.paths ?? {}).filter((p) => !(p in (base.paths ?? {})));
if (added.length) console.log(`non-breaking: ${added.length} new path(s): ${added.join(', ')}`);
if (problems.length) {
  console.error(
    `✗ ${problems.length} breaking change(s) to /v1 — bump the API version or make the change additive:`,
  );
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('✓ no breaking changes to /v1');
