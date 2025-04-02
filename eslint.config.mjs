// @ts-check

import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        project: ["./packages/*/tsconfig.json", "./packages/*/tsconfig.test.json"],
      },
    },
  },
  {
    ignores: ["**/dist/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unsafe-call": "off",
    }
  },
  {
    files: ["**/*.test.ts", "**/tests/**/*.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly"
      }
    }
  }
);
