/** Integration tests: real Postgres/PostGIS + Redis (Testcontainers unless DATABASE_URL/REDIS_URL are set). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.int.test.ts'],
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  testTimeout: 60000,
};
