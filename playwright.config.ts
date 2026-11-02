import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
process.env.CLERK_PUBLISHABLE_KEY ??=
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default defineConfig({
  reporter: "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
  projects: [
    {
      name: "public",
      testDir: "./e2e/public",
      // Every first visit goes through Clerk's servers, which can stall.
      timeout: 60_000,
      retries: 1,
      fullyParallel: true,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "signed-in-setup",
      testDir: "./e2e/signed-in",
      testMatch: "auth.setup.ts",
      timeout: 120_000,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "signed-in",
      testDir: "./e2e/signed-in",
      dependencies: ["signed-in-setup"],
      // The flows share three test users, and their actions count against one rate limit.
      workers: 1,
      fullyParallel: false,
      timeout: 120_000,
      retries: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "n8n",
      testDir: "./e2e/n8n",
      // These tests stop n8n, and `n8n execute` binds fixed ports, so runs cannot overlap.
      workers: 1,
      fullyParallel: false,
      timeout: 240_000,
    },
  ],
});
