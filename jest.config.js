export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  roots: ["<rootDir>"],
  testMatch: ["**/tests/**/*.test.ts"],
  // Enable test location tracking for test explorer
  testLocationInResults: true,
  // Display name for better test explorer experience
  displayName: {
    name: "Context-First Docs",
    color: "blue",
  },
  // Enforce a minimum baseline in CI (run with --coverage).
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 85,
      lines: 80,
    },
  },
};
