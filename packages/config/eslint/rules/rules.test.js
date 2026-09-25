import { RuleTester } from 'eslint';
import { test } from 'node:test';
import noJsxLiteral from './no-jsx-literal.js';
import noPhysicalDirection from './no-physical-direction.js';

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

test('no-physical-direction', () => {
  tester.run('no-physical-direction', noPhysicalDirection, {
    valid: [
      '<div className="ms-4 pe-2 text-start" />',
      'cn("ps-3", isOpen && "me-1")',
      'const s = { marginStart: 4 }',
      '<div className="mx-4 py-2 rounded-lg" />',
    ],
    invalid: [
      { code: '<div className="ml-4" />', errors: [{ messageId: 'className' }] },
      { code: '<div className="md:pr-2" />', errors: [{ messageId: 'className' }] },
      { code: 'cn("flex text-left")', errors: [{ messageId: 'className' }] },
      { code: '<div className={`p-2 -mr-1`} />', errors: [{ messageId: 'className' }] },
      { code: 'const s = { paddingLeft: 4 }', errors: [{ messageId: 'style' }] },
      { code: "const s = { textAlign: 'right' }", errors: [{ messageId: 'textAlign' }] },
    ],
  });
});

test('no-jsx-literal', () => {
  tester.run('no-jsx-literal', noJsxLiteral, {
    valid: ['<p>{t("home.title")}</p>', '<p>{price} · 2024</p>', '<img alt={t("a")} />'],
    invalid: [
      { code: '<p>Hello</p>', errors: [{ messageId: 'text' }] },
      { code: '<p>مرحبا</p>', errors: [{ messageId: 'text' }] },
      { code: '<button aria-label="Close" />', errors: [{ messageId: 'attr' }] },
    ],
  });
});
