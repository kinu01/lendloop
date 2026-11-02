import convexPlugin from "@convex-dev/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

const FEATURES = ["tools", "loans", "admin"];
const FUNCTION_FILES = [
  "tools",
  "loans",
  "users",
  "admin",
  "notify",
  "reminders",
  "automation",
  "seed",
];

function forbid(group, message) {
  return { group, message };
}

function layer(files, ...patterns) {
  return {
    files,
    rules: { "no-restricted-imports": ["error", { patterns }] },
  };
}

const notFromSrc = [
  forbid(
    ["../**/convex/**", "./**/convex/**"],
    "Import Convex code through the @convex alias.",
  ),
  forbid(["@convex/model/*"], "The browser must not import the backend model."),
];

const featureLayers = FEATURES.map((feature) =>
  layer(
    [`src/components/${feature}/**`],
    ...notFromSrc,
    forbid(
      FEATURES.filter((other) => other !== feature).map(
        (other) => `@/components/${other}/*`,
      ),
      "Feature folders never import each other. Move shared parts to common.",
    ),
  ),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...convexPlugin.configs.recommended,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    rules: { "@typescript-eslint/no-floating-promises": "error" },
  },
  layer(["src/**"], ...notFromSrc),
  ...featureLayers,
  layer(
    ["src/components/layout/**", "src/components/common/**"],
    ...notFromSrc,
    forbid(
      FEATURES.map((feature) => `@/components/${feature}/*`),
      "Shared parts must not know about features.",
    ),
  ),
  layer(
    ["src/components/ui/**"],
    forbid(
      [
        ...["common", "layout", ...FEATURES].map(
          (folder) => `@/components/${folder}/*`,
        ),
        "@/hooks/*",
        "@convex/*",
      ],
      "ui holds shadcn parts only, with no app knowledge or data.",
    ),
  ),
  layer(
    ["src/hooks/**"],
    ...notFromSrc,
    forbid(["@/components/*"], "Hooks hold behavior with no markup."),
  ),
  layer(
    ["src/lib/**"],
    ...notFromSrc,
    forbid(["@/components/*", "@/hooks/*"], "lib holds pure helpers."),
  ),
  layer(
    ["convex/*.ts"],
    forbid(
      FUNCTION_FILES.map((file) => `./${file}`),
      "A function file never imports another. Move shared logic to model.",
    ),
  ),
  layer(
    ["convex/model/**"],
    forbid(
      FUNCTION_FILES.map((file) => `../${file}`),
      "model must not import function files.",
    ),
  ),
  layer(
    ["convex/lib/**"],
    forbid(
      ["../model/*", ...FUNCTION_FILES.map((file) => `../${file}`)],
      "lib must not import model or function files.",
    ),
  ),
  {
    // The Convex CLI reads this file at deploy time, before the typed env exists.
    files: ["convex/auth.config.ts"],
    rules: { "@convex-dev/no-process-env": "off" },
  },
  {
    files: ["convex/*.test.ts", "convex/lib/*.test.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "convex/_generated/**",
  ]),
]);

export default eslintConfig;
