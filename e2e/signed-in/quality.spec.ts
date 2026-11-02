import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, listTool, removeListing, test, uniqueName } from "../fixtures";

const TAB_PAGES = [
  "/admin?tab=loans",
  "/admin?tab=people",
  "/admin?tab=failures",
  "/incoming?tab=approved",
  "/incoming?tab=past",
];

const PAGES = [
  { path: "/board", title: "All tools | LendLoop", heading: "All tools" },
  {
    path: "/listings",
    title: "My listings | LendLoop",
    heading: "My listings",
  },
  {
    path: "/requests",
    title: "My requests | LendLoop",
    heading: "My requests",
  },
  {
    path: "/incoming",
    title: "Incoming requests | LendLoop",
    heading: "Incoming requests",
  },
  { path: "/admin", title: "Admin | LendLoop", heading: "Admin" },
];

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page: page as never })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Clerk owns its account button and popups.
    .exclude(".cl-rootBox")
    .analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`every page passes axe with no sideways scroll, ${colorScheme}, ${width}px`, async ({
      open,
      cspViolations,
    }) => {
      const page = await open("admin", {
        colorScheme,
        viewport: { width, height: 800 },
      });
      for (const { path, heading } of PAGES) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0);
        await expectNoAxeViolations(page);
        await expectNoSidewaysScroll(page);
      }
      for (const path of TAB_PAGES) {
        await page.goto(path);
        await expect(page.getByRole("tabpanel")).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0);
        await expectNoAxeViolations(page);
        await expectNoSidewaysScroll(page);
      }
      expect(cspViolations).toEqual([]);
    });
  }

  test(`the dialogs pass axe and the content security policy, ${colorScheme}`, async ({
    open,
    cspViolations,
  }) => {
    const owner = await open("owner", { colorScheme });
    const name = uniqueName("Axe test");
    await listTool(owner, name);

    await owner.getByRole("button", { name: `Edit: ${name}` }).click();
    await owner.getByRole("dialog").waitFor();
    await expectNoAxeViolations(owner);
    await owner.keyboard.press("Escape");
    await owner.getByRole("dialog").waitFor({ state: "hidden" });
    await expect(
      owner.getByRole("button", { name: `Edit: ${name}` }),
    ).toBeFocused();

    await owner.getByRole("button", { name: `Remove: ${name}` }).click();
    await owner.getByRole("alertdialog").waitFor();
    await expect(owner.getByRole("button", { name: "Go back" })).toBeFocused();
    await expectNoAxeViolations(owner);
    await owner.getByRole("button", { name: "Go back" }).click();

    const borrower = await open("borrower", { colorScheme });
    await borrower.goto("/board");
    await borrower
      .getByRole("button", { name: `Request to borrow: ${name}` })
      .click();
    await borrower.getByRole("dialog").waitFor();
    await expectNoAxeViolations(borrower);

    await removeListing(owner, name);
    expect(cspViolations).toEqual([]);
  });
}

test("buttons and selects show the pointer cursor", async ({ open }) => {
  const page = await open("borrower");
  await page.goto("/listings");
  await expect(page.getByRole("button", { name: "List a tool" })).toHaveCSS(
    "cursor",
    "pointer",
  );
  await page.goto("/board");
  await expect(page.getByLabel("Category")).toHaveCSS("cursor", "pointer");
});

test("arrow keys move between tabs", async ({ open }) => {
  const page = await open("owner");
  await page.goto("/incoming");
  await page.getByRole("tab", { name: /Needs reply/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Approved" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("each page has its title, and signed-in pages ask not to be indexed", async ({
  open,
}) => {
  const page = await open("admin");
  for (const { path, title } of PAGES) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});

test("the page keeps its navigation when a phone-width menu wraps", async ({
  open,
}) => {
  const page = await open("borrower", {
    viewport: { width: 390, height: 800 },
  });
  await page.goto("/board");
  for (const name of ["All tools", "My listings", "My requests"]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
});
