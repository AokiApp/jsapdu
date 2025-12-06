import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "examples/mynacard-e2e/*.test.ts"],
    // E2E tests are automatically skipped in CI environments (when CI=true)
    // unless RUN_E2E_TESTS=true is explicitly set.
    // This allows:
    // - Local development: Run all tests with `npm test` or just E2E with `npm run test:e2e`
    // - CI: Run only unit tests with `npm run test:ci` (CI=true is set)
    // - CI with E2E: Set RUN_E2E_TESTS=true and ensure libpcsclite-dev is installed
    exclude:
      process.env.CI && !process.env.RUN_E2E_TESTS
        ? ["examples/mynacard-e2e/**"]
        : [],
  },
});
