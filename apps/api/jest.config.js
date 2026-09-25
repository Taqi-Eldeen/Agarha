/** Unit tests: no network, no database. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  collectCoverageFrom: ['src/modules/**/*.ts', '!src/**/*.module.ts', '!src/**/index.ts'],
};
