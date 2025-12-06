import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "examples/mynacard-e2e/*.test.ts"],
    // E2E tests run by default (local development with hardware)
    // They are ONLY skipped when SKIP_E2E_TESTS=true is explicitly set
    // This preserves the original behavior where E2E tests run by default
    // For CI without hardware, use: SKIP_E2E_TESTS=true npm test
    exclude: process.env.SKIP_E2E_TESTS === "true" ? ["examples/mynacard-e2e/**"] : [],
  },
});
