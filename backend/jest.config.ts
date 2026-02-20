import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts', '!**/index.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/libs/', '<rootDir>/services/'],
  moduleNameMapper: {
    '^@libs/auth(|/.*)$': '<rootDir>/libs/auth/src/$1',
    '^@libs/dto(|/.*)$': '<rootDir>/libs/dto/src/$1',
    '^@libs/dynamodb(|/.*)$': '<rootDir>/libs/dynamodb/src/$1',
    '^@libs/errors(|/.*)$': '<rootDir>/libs/errors/src/$1',
    '^@libs/logging(|/.*)$': '<rootDir>/libs/logging/src/$1',
    '^@libs/utils(|/.*)$': '<rootDir>/libs/utils/src/$1',
  },
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
