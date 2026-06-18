import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/integration/identity/**/*.integration.test.ts',
    '**/integration/catalog/**/*.integration.test.ts',
    '**/integration/commerce/**/*.integration.test.ts',
    '**/integration/fulfillment/**/*.integration.test.ts',
    '**/integration/engagement/**/*.integration.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 120000,
  verbose: true,
  forceExit: true,
};

export default config;
