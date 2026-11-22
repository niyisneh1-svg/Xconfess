const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  collectCoverageFrom: [
    'src/auth/admin.guard.ts',
    'src/auth/capabilities/capability.guard.ts',
    'src/auth/guards/moderation-access-grant.guard.ts',
    'src/auth/guards/step-up.guard.ts',
    'src/common/guards/ownership.guard.ts',
  ],
  coverageDirectory:
    process.env.GUARD_COVERAGE_DIRECTORY || '<rootDir>/.coverage-guards',
  coverageReporters: ['json'],
  coverageThreshold: undefined,
};
