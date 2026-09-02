import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  // Every e2e suite, not just identity's. Until Phase 9.3 this read `**/e2e/identity/**`, and
  // `src/tests/e2e/engagement/` was matched by no config at all — an entire suite that no command
  // ran. `jest.e2e.{catalog,commerce}.config.ts` existed for the same reason and were referenced by
  // no script; they are gone, subsumed here. Do not narrow this back to a per-context glob.
  testMatch: ['**/e2e/**/*.e2e.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 180000,
  verbose: true,
  forceExit: true,
};

export default config;
