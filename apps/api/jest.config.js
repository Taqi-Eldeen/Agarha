/** Unit tests: no network, no database. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.(t|j|mj)s$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022' }, module: { type: 'commonjs' } }] },
  // jose is ESM-only; let SWC turn it into CommonJS for Jest.
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/jose@|jose/))'],
  collectCoverageFrom: ['src/modules/**/*.ts', '!src/**/*.module.ts', '!src/**/index.ts'],
};
