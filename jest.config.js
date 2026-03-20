/**
 * Jest Configuration
 */

module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./server/tests/setup.js'],
  testMatch: [
    '**/server/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/tests/**',
    '!server/database/init.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  verbose: true,
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true
};
