import { randomUUID } from "node:crypto";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  expect,
  test as base,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";
import { sessionFile, type Role } from "./signed-in/roles";

type Open = (role: Role, options?: BrowserContextOptions) => Promise<Page>;

const listedTools = new Map<string, Page>();

export const test = base.extend<{ open: Open; cspViolations: string[] }>({
  cspViolations: async ({}, provide) => {
    await provide([]);
  },
  open: async ({ browser, baseURL, cspViolations }, provide, testInfo) => {
    const contexts: { close: () => Promise<void> }[] = [];
    listedTools.clear();
    await provide(async (role, options) => {
      const context = await browser.newContext({
        baseURL,
        storageState: sessionFile(role),
        // The app dates loans in UTC, so the tests must not depend on this machine's zone.
        timezoneId: "UTC",
        ...options,
      });
      contexts.push(context);
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.text().includes("Content Security Policy"))
          cspViolations.push(message.text());
      });
      await setupClerkTestingToken({ page });
      return page;
    });
    if (testInfo.status !== testInfo.expectedStatus) {
      for (const [name, page] of listedTools) {
        page.setDefaultTimeout(5_000);
        await removeListing(page, name).catch(() => undefined);
      }
    }
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };

export function uniqueName(label: string) {
  return `${label} ${randomUUID().slice(0, 8)}`;
}

export async function listTool(page: Page, name: string) {
  await page.goto("/listings");
  await page.getByRole("button", { name: "List a tool" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Category").selectOption("garden");
  await page.getByRole("button", { name: "List tool" }).click();
  await page.getByRole("heading", { name }).waitFor();
  listedTools.set(name, page);
}

// "Nothing is shown" proves nothing while the list is still loading.
export async function dataLoaded(page: Page) {
  await page.getByRole("main").waitFor();
  await expect(
    page.getByRole("status").filter({ hasText: /^Loading/ }),
  ).toHaveCount(0);
}

export async function requestTool(page: Page, name: string) {
  await page.goto("/board");
  await page
    .getByRole("button", { name: `Request to borrow: ${name}` })
    .click();
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByText("You asked for").first().waitFor();
}

export async function confirm(
  page: Page,
  opener: string,
  confirmLabel: string,
) {
  await page.getByRole("button", { name: opener }).click();
  await page.getByRole("button", { name: confirmLabel }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
}

export async function removeListing(page: Page, name: string) {
  await page.goto("/listings");
  await confirm(page, `Remove: ${name}`, "Yes, remove");
  listedTools.delete(name);
}
