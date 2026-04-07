import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

const ignoredPaths = [
  "**/node_modules/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/dist/**",
  "**/coverage/**",
  "**/next-env.d.ts"
];

export default tseslint.config(
  { ignores: ignoredPaths },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "no-unused-vars": "off"
    }
  },
  {
    files: ["apps/**/*.{js,jsx,mjs,ts,tsx}"],
    ...nextPlugin.configs.recommended,
    settings: {
      next: {
        rootDir: ["apps/*/"]
      }
    }
  },
  {
    files: ["apps/**/*.{js,jsx,mjs,ts,tsx}"],
    ...nextPlugin.configs["core-web-vitals"],
    settings: {
      next: {
        rootDir: ["apps/*/"]
      }
    }
  },
  {
    files: ["**/next.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly"
      }
    }
  },
  {
    files: ["apps/**/*.{js,jsx,mjs,ts,tsx}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  }
);
