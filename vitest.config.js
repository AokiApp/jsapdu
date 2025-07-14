import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        include: ["packages/**/*.test.ts", "examples/mynacard-e2e/*.test.ts"],
    },
});
