/** Integration tests: real Postgres/PostGIS + Redis (Testcontainers unless DATABASE_URL/REDIS_URL are set). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.int.test.ts'],
  transform: {
    '^.+\\.(t|j|mj)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  // jose is ESM-only; let SWC turn it into CommonJS for Jest.
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/jose@|jose/))'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  testTimeout: 60000,
};
