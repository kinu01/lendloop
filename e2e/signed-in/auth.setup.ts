import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { emailFor, ROLES, sessionFile, type Role } from "./roles";

const exec = promisify(execFile);

setup.describe.configure({ mode: "serial" });

setup("get a Clerk testing token", async () => {
  await clerkSetup();
});

for (const role of Object.keys(ROLES) as Role[]) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: emailFor(role) });
    await page.goto("/board");
    await expect(page.getByRole("heading", { name: "All tools" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("status").first()).not.toHaveText("Loading…");
    await page.context().storageState({ path: sessionFile(role) });
  });
}

setup("reset rate limits, and give each user their role", async () => {
  for (const role of Object.keys(ROLES) as Role[]) {
    await exec("npx", [
      "convex",
      "run",
      "seed:resetRateLimitsFor",
      JSON.stringify({ email: emailFor(role) }),
    ]);
    await exec("npx", [
      "convex",
      "run",
      "users:setRole",
      JSON.stringify({
        email: emailFor(role),
        role: role === "admin" ? "admin" : "user",
      }),
    ]);
  }
});
