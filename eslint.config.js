// SPDX-License-Identifier: AGPL-3.0-or-later
// Package boundaries (§3) are enforced here, together with pnpm's strict dependencies.
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

const LOCAL_ONLY_SCHEMA = ["@astro/schema/chart", "@astro/schema/local", "@astro/schema/identifying", "@astro/schema/file"];
const NETWORK_GLOBALS = [
  { name: "fetch", message: "Network I/O is only allowed in apps/web/src/net/*." },
  { name: "XMLHttpRequest", message: "Network I/O is only allowed in apps/web/src/net/*." },
  { name: "WebSocket", message: "Network I/O is only allowed in apps/web/src/net/*." },
  { name: "EventSource", message: "Network I/O is only allowed in apps/web/src/net/*." },
];
const NETWORK_SYNTAX = [
  { selector: "MemberExpression[property.name='sendBeacon']", message: "Network I/O is only allowed in apps/web/src/net/*." },
  { selector: "MemberExpression[object.name='window'][property.name='fetch']", message: "Network I/O is only allowed in apps/web/src/net/*." },
  { selector: "MemberExpression[object.name='globalThis'][property.name='fetch']", message: "Network I/O is only allowed in apps/web/src/net/*." },
  { selector: "MemberExpression[object.name='self'][property.name='fetch']", message: "Network I/O is only allowed in apps/web/src/net/*." },
];

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.wrangler/**", "**/*.d.ts", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: [".svelte"] } },
    rules: {
      // No {@html}: every string is rendered through Svelte's escaping.
      "svelte/no-at-html-tags": "error",
      "svelte/require-each-key": "error",
    },
  },

  // payload: sees only the public analysis, never charts, dates, maraka or identifying data.
  {
    files: ["packages/payload/src/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: LOCAL_ONLY_SCHEMA.map((name) => ({ name, message: "The payload builder may only import the public analysis and payload schemas." })),
        patterns: [{ group: ["@astro/core", "@astro/core/*", "@astro/analysis", "@astro/chartfile", "../../*"], message: "The payload builder depends on @astro/schema only." }],
      }],
    },
  },
  // analysis: pure TS, schema types only, no engine runtime, no I/O.
  {
    files: ["packages/analysis/src/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "@astro/schema/identifying", message: "Analysis never sees birth data." }],
        patterns: [{ group: ["@astro/core", "@astro/core/*", "@astro/payload", "@astro/chartfile"], message: "Analysis depends on @astro/schema only; the worker wires core output into it." }],
      }],
      "no-restricted-globals": ["error", ...NETWORK_GLOBALS],
    },
  },
  // proxy and prompts: payload + api schemas and prompts only.
  {
    files: ["apps/proxy/src/**", "packages/prompts/src/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: LOCAL_ONLY_SCHEMA.map((name) => ({ name, message: "The proxy and prompts never handle local-only or identifying data." })),
        patterns: [{ group: ["@astro/core", "@astro/core/*", "@astro/analysis", "@astro/chartfile", "@astro/payload"], message: "Proxy/prompts depend on @astro/schema (payload, api) and @astro/prompts only." }],
      }],
    },
  },
  // Web app: only src/net/* may do network I/O.
  {
    files: ["apps/web/src/**"],
    ignores: ["apps/web/src/net/**", "apps/web/src/sw.ts"],
    rules: {
      "no-restricted-globals": ["error", ...NETWORK_GLOBALS],
      "no-restricted-syntax": ["error", ...NETWORK_SYNTAX],
    },
  },
);
