import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/tests/unit/domain/catalog/**/*.test.ts',
    '**/tests/unit/application/catalog/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/domain/catalog/**/*.ts',
    'src/application/catalog/**/*.ts',
    '!src/application/catalog/handlers/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  coverageReporters: ['text-summary', 'text'],
  testTimeout: 60000,
  verbose: false,
  forceExit: true,
};

export default config;
