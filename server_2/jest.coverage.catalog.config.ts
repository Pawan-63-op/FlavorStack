import type { Config } from 'jest';

// Catalog module coverage gate (Phase 14). Runs the pure unit suite for the catalog
// domain + application layers and enforces the ≥80% bar across all four metrics.
//
// The in-process projector (`application/catalog/handlers/`) is excluded here: it is
// infrastructure-coupled glue exercised by the catalog INTEGRATION suite
// (read-model-projector / catalog-cache), not by mockable unit tests. Search/repo
// adapters live in `infrastructure/` and are likewise integration-covered.
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
