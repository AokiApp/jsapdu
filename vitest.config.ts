import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    workspace: ["packages/*"],
    globals: true,
    environment: "node",
    include: ["packages/*/tests/**/*.test.ts"],
    setupFiles: ["packages/*/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/tests/**"]
    }
  },
  resolve: { alias: { "@aokiapp": "./packages" } }
});
