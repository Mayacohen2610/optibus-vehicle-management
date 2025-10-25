import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',          // transpile TS on the fly
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/tests/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html']
};

export default config;
