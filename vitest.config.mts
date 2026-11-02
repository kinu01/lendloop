import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@convex": fileURLToPath(new URL("./convex", import.meta.url)),
};

export default defineConfig({
  test: {
    // The first test in a file also pays for its imports, which is slow on a busy machine.
    testTimeout: 15_000,
    coverage: {
      include: ["convex/**/*.ts", "src/**/*.{ts,tsx}"],
      exclude: [
        "convex/_generated/**",
        "convex/seed.ts",
        "convex/**/*.config.ts",
        "convex/test.*",
        "**/*.test.*",
        "src/test/**",
        "src/components/ui/**",
      ],
      thresholds: {
        "convex/**/*.ts": { lines: 90, statements: 90, functions: 90 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "backend",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
