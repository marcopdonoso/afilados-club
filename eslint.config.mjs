import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    ".vitest/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "supabase/.temp/**",
    "supabase/.branches/**",
  ]),
]);
