import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const preset = require('../build/tailwind-preset.js');
const { theme } = require('../build/native/theme.js');
const css = readFileSync(new URL('../build/css/tokens.css', import.meta.url), 'utf8');

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

test('css exposes light and dark brand colour', () => {
  assert.match(css, /--ag-color-brand-primary: 15 110 104;/);
  assert.match(css, /--ag-color-brand-primary: 76 192 181;/);
  assert.match(css, /prefers-reduced-motion/);
});

test('tailwind preset maps colours to css vars', () => {
  assert.equal(preset.theme.extend.colors.brand.DEFAULT, 'rgb(var(--ag-color-brand-primary) / <alpha-value>)');
  assert.deepEqual(Object.keys(preset.theme.screens), ['md', 'lg', 'xl']);
  assert.equal(preset.theme.extend.fontSize.body[1].lineHeight, 'var(--ag-leading-body)');
});

test('native theme has both schemes with identical keys', () => {
  assert.deepEqual(Object.keys(theme.colors.light), Object.keys(theme.colors.dark));
  assert.equal(theme.colors.dark.brandPrimary, '#4CC0B5');
  assert.equal(theme.type.body.lineHeightAr, 26);
});

// WCAG 2.2 AA: 4.5:1 for text on page and card surfaces in both schemes.
for (const scheme of ['light', 'dark']) {
  test(`${scheme}: text colours meet 4.5:1 on surfaces`, () => {
    const c = theme.colors[scheme];
    for (const fg of ['textPrimary', 'textSecondary', 'brandPrimary', 'statusDanger', 'statusInfo', 'statusAvailable']) {
      for (const bg of ['surfacePage', 'surfaceCard']) {
        const ratio = contrast(c[fg], c[bg]);
        assert.ok(ratio >= 4.5, `${fg} on ${bg} = ${ratio.toFixed(2)}`);
      }
    }
    assert.ok(contrast(c.textPrimary, c.accentFeatured) >= 4.5, 'text on featured');
  });
}
