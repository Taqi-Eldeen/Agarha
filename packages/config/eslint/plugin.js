import noJsxLiteral from './rules/no-jsx-literal.js';
import noPhysicalDirection from './rules/no-physical-direction.js';

export default {
  meta: { name: 'eslint-plugin-agarha' },
  rules: {
    'no-jsx-literal': noJsxLiteral,
    'no-physical-direction': noPhysicalDirection,
  },
};
