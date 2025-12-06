import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude e2e tests by default as they require hardware
    include: ["packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "examples/mynacard-e2e/**"],
  },
});
