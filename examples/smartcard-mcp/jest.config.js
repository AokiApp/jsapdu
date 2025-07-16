/**
 * Jest configuration for Smart Card MCP Server
 * ESM + TypeScript support
 */
export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",

  // Module path mappings
  moduleNameMapping: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Test file patterns
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.spec.ts"],

  // Coverage settings
  collectCoverage: false,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts", // Entry point - integration test only
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Setup and teardown
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // Transform configuration
  globals: {
    "ts-jest": {
      useESM: true,
      tsconfig: {
        module: "ESNext",
        target: "ES2022",
        moduleResolution: "node",
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    },
  },

  // Mock patterns
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  clearMocks: true,
  restoreMocks: true,

  // Test timeout
  testTimeout: 30000,

  // Verbose output for debugging
  verbose: true,

  // Parallel testing
  maxWorkers: "50%",

  // Error handling
  errorOnDeprecated: true,

  // Performance monitoring
  detectOpenHandles: true,
  forceExit: true,
};
