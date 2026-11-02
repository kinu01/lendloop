import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const toolItems = (page: Page) =>
  page.getByRole("region", { name: "Available now" }).getByRole("listitem");
const firstCard = (page: Page) => toolItems(page).first();

async function openHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(firstCard(page)).toBeVisible();
}

test("the public page shows names and categories, and no owner details", async ({
  page,
}) => {
  await openHome(page);
  await expect(
    page.getByRole("button", { name: "Sign in to lend or borrow" }),
  ).toBeVisible();
  const cards = await toolItems(page).all();
  for (const card of cards) {
    await expect(card.locator("> *")).toHaveCount(2);
  }
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("@");
  expect(text).not.toContain("Lent by");
});

test("the sign-in text greets a new visitor plainly", async ({ page }) => {
  await openHome(page);
  const button = page.getByRole("button", {
    name: "Sign in to lend or borrow",
  });
  await expect
    .poll(
      () =>
        button.evaluate((el) =>
          Object.keys(el).some((key) => key.startsWith("__react")),
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  await button.click();
  await expect(
    page.getByText("Use your email or Google account to continue."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Welcome back")).toHaveCount(0);
});

test("the sign-in button opens Clerk", async ({ page }) => {
  await openHome(page);
  const button = page.getByRole("button", {
    name: "Sign in to lend or borrow",
  });
  // The list is server-rendered, so it can appear before the dev server hydrates the button.
  await expect
    .poll(
      () =>
        button.evaluate((el) =>
          Object.keys(el).some((key) => key.startsWith("__react")),
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  await button.click();
  await expect(page.locator('input[name="identifier"]')).toBeVisible({
    timeout: 20_000,
  });
});

for (const path of [
  "/board",
  "/listings",
  "/requests",
  "/incoming",
  "/admin",
]) {
  test(`${path} sends a signed-out visitor to sign-in`, async ({ page }) => {
    await page.goto(path, { waitUntil: "commit" });
    await expect(page).toHaveURL(/sign-in/);
  });
}

for (const [width, colorScheme] of [
  [375, "light"],
  [375, "dark"],
  [1280, "light"],
  [1280, "dark"],
] as const) {
  test(`no WCAG violations and no sideways scroll at ${width}px, ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme });
    await openHome(page);
    // The axe package bundles its own Playwright types.
    const { violations } = await new AxeBuilder({ page: page as never })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}

test("buttons show the pointer cursor", async ({ page }) => {
  await openHome(page);
  await expect(
    page.getByRole("button", { name: "Sign in to lend or borrow" }),
  ).toHaveCSS("cursor", "pointer");
});

test("the skip link is the first Tab stop and moves focus to main", async ({
  page,
}) => {
  await openHome(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("an unknown page answers 404 with a way home", async ({ page }) => {
  const response = await page.goto("/does-not-exist", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Go to the LendLoop home page" }),
  ).toBeVisible();
});

test("the tool list is in the first HTML response, before any script runs", async ({
  page,
  request,
}) => {
  await openHome(page);
  const name = await firstCard(page).locator("> *").first().innerText();
  const html = await (await request.get("/")).text();
  expect(html).toContain(name);
});

test.describe("page titles", () => {
  test("the home page has its own title", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(
      "LendLoop: borrow and lend tools with your neighbors",
    );
  });

  test("an unknown page uses the title template", async ({ page }) => {
    await page.goto("/no-such-page", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Page not found | LendLoop");
  });
});

test.describe("security", () => {
  test("responses carry the security headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBeTruthy();
    expect(headers["x-powered-by"]).toBeUndefined();
    const csp = headers["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/script-src[^;]*'nonce-/);
  });

  test("injected markup cannot run script", async ({ page }) => {
    await openHome(page);
    const result = await page.evaluate(async () => {
      const win = window as unknown as Record<string, unknown>;
      document.body.insertAdjacentHTML(
        "beforeend",
        '<img src="x" onerror="window.__injected = 1">',
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      return win.__injected;
    });
    expect(result).toBeUndefined();
  });

  test("another site cannot frame the app", async ({ page, baseURL }) => {
    await page.setContent(`<iframe src="${baseURL}/"></iframe>`);
    await page.waitForTimeout(1500);
    const frames = page.frames().slice(1);
    for (const frame of frames) {
      await expect(frame.locator("h1")).toHaveCount(0);
    }
  });
});
