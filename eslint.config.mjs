import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent tooling scratch space (worktrees and their own `.next` build output).
    // Never project source, and the nested `.next` dirs are not covered by the
    // root-relative `.next/**` above.
    ".claude/**",
  ]),
]);

export default eslintConfig;
