import type { Config } from 'jest';

/**
 * Jest configuration for the Reservations service.
 *
 * Mirrors the root backend jest.config.ts so tests run consistently
 * both from the service directory and from the monorepo root.
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/infrastructure/handlers/lambda.handler.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
