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
      },
    },
  },
  {
    ignores: [
      "**/dist/**",
      ".private.local/",
      "eslint.config.mjs",
      "vitest.config.js",
      "packages/pcsc/tests/*.js",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
    },
  },
);
