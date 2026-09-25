/**
 * Unit + integration together, for the section 11 target: >= 80% line coverage on domain modules
 * (src/modules). CI runs this instead of the plain integration suite.
 */
const integration = require('./jest.integration.config');

module.exports = {
  ...integration,
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  coverageThreshold: { global: { lines: 80 } },
};
