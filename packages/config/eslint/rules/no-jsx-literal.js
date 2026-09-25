/**
 * All user-facing copy lives in the i18n catalogs (packages/i18n).
 * Flags raw text inside JSX and string literals in user-facing attributes.
 */
const USER_FACING_ATTRS = new Set([
  'alt',
  'title',
  'placeholder',
  'label',
  'aria-label',
  'aria-description',
  'accessibilityLabel',
  'accessibilityHint',
]);
// Allow punctuation, digits and symbols that never need translating.
const ALLOWED = /^[\s\d.,:;!?·•—–\-+×/\\|()[\]{}%#*&@'"«»…]*$/u;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hardcoded user-facing strings in JSX' },
    messages: {
      text: 'Hardcoded JSX text "{{text}}". Move it to the i18n catalog.',
      attr: 'Hardcoded "{{attr}}" value. Move it to the i18n catalog.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value.trim();
        if (text && !ALLOWED.test(text))
          context.report({ node, messageId: 'text', data: { text: text.slice(0, 30) } });
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || !USER_FACING_ATTRS.has(node.name.name)) return;
        const v = node.value;
        const str =
          v?.type === 'Literal'
            ? v.value
            : v?.type === 'JSXExpressionContainer' && v.expression.type === 'Literal'
              ? v.expression.value
              : null;
        if (typeof str === 'string' && str.trim() && !ALLOWED.test(str))
          context.report({ node, messageId: 'attr', data: { attr: node.name.name } });
      },
    };
  },
};
