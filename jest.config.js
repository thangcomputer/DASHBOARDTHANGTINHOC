module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/shared/**/__tests__/**/*.test.js',
    '<rootDir>/shared/**/?(*.)+(spec|test).js',
    '<rootDir>/modules/**/__tests__/**/*.test.js',
    '<rootDir>/modules/**/?(*.)+(spec|test).js',
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
};
