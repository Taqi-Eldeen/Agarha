/**
 * Bans physical left/right spacing so layouts mirror correctly in RTL.
 * Use logical equivalents instead: ms-/me-/ps-/pe-, text-start/text-end,
 * marginStart/marginEnd (RN) or margin-inline-start (CSS).
 */
const CLASS_PATTERN =
  /(?:^|[\s:])(-?(?:ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)(?:-[\w./[\]]+)?|text-left|text-right|float-left|float-right)(?=$|\s)/;
const STYLE_KEYS = new Set([
  'marginLeft',
  'marginRight',
  'paddingLeft',
  'paddingRight',
  'borderLeftWidth',
  'borderRightWidth',
  'borderLeftColor',
  'borderRightColor',
]);
const CLASS_ATTRS = /^(className|\w+ClassName|class)$/;
const CLASS_FNS = new Set(['cn', 'clsx', 'cva', 'twMerge']);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow physical left/right margins, paddings and alignment' },
    messages: {
      className: 'Physical direction class "{{cls}}". Use a logical class (ms-/me-/ps-/pe-/text-start/text-end).',
      style: 'Physical style key "{{key}}". Use {{alt}}.',
      textAlign: 'textAlign "{{value}}" is physical. Use "start"/"end" (CSS) or rely on writing direction (RN).',
    },
    schema: [],
  },
  create(context) {
    function checkString(node, value) {
      const m = CLASS_PATTERN.exec(value);
      if (m) context.report({ node, messageId: 'className', data: { cls: m[1] } });
    }
    function checkExpr(node) {
      if (!node) return;
      if (node.type === 'Literal' && typeof node.value === 'string') checkString(node, node.value);
      else if (node.type === 'TemplateLiteral')
        node.quasis.forEach((q) => checkString(q, q.value.cooked ?? ''));
      else if (node.type === 'ConditionalExpression') {
        checkExpr(node.consequent);
        checkExpr(node.alternate);
      } else if (node.type === 'LogicalExpression') checkExpr(node.right);
    }
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || !CLASS_ATTRS.test(node.name.name)) return;
        const v = node.value;
        if (!v) return;
        if (v.type === 'Literal') checkExpr(v);
        else if (v.type === 'JSXExpressionContainer') checkExpr(v.expression);
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && CLASS_FNS.has(node.callee.name))
          node.arguments.forEach(checkExpr);
      },
      Property(node) {
        const key =
          node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal'
              ? String(node.key.value)
              : null;
        if (!key) return;
        if (STYLE_KEYS.has(key)) {
          const alt = key.replace('Left', 'Start').replace('Right', 'End');
          context.report({ node, messageId: 'style', data: { key, alt } });
        }
        if (
          key === 'textAlign' &&
          node.value.type === 'Literal' &&
          (node.value.value === 'left' || node.value.value === 'right')
        )
          context.report({ node, messageId: 'textAlign', data: { value: node.value.value } });
      },
    };
  },
};
