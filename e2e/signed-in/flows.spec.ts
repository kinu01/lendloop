import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  confirm,
  dataLoaded,
  expect,
  listTool,
  removeListing,
  requestTool,
  test,
  uniqueName,
} from "../fixtures";

const exec = promisify(execFile);

test("an owner lists a tool, edits it, and removes it", async ({ open }) => {
  const owner = await open("owner");
  const name = uniqueName("Rake");
  const renamed = uniqueName("Garden rake");
  await listTool(owner, name);

  await owner.getByRole("button", { name: `Edit: ${name}` }).click();
  await owner.getByLabel("Name").fill(renamed);
  await owner.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByRole("heading", { name: renamed })).toBeVisible();

  await removeListing(owner, renamed);
  await expect(owner.getByRole("heading", { name: renamed })).toHaveCount(0);
});

test("a blank name is refused with a message, and nothing is listed", async ({
  open,
}) => {
  const owner = await open("owner");
  await owner.goto("/listings");
  await owner.getByRole("button", { name: "List a tool" }).click();
  await owner.getByRole("button", { name: "List tool" }).click();
  await expect(owner.getByRole("alert")).toHaveText(
    "Enter a name for the tool.",
  );
  await expect(owner.getByRole("dialog")).toBeVisible();
});

test("a loan runs from request to approval to return, and contact details appear only once approved", async ({
  open,
}) => {
  const owner = await open("owner");
  const borrower = await open("borrower");
  const name = uniqueName("Ladder");
  await listTool(owner, name);
  await requestTool(borrower, name);

  await borrower.goto("/requests");
  const row = borrower.getByRole("listitem").filter({ hasText: name });
  await expect(row.getByText("Pending", { exact: true })).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);

  await owner.goto("/incoming");
  await owner.getByRole("button", { name: `Approve: ${name}` }).click();
  await expect(
    owner.getByRole("button", { name: `Approve: ${name}` }),
  ).toHaveCount(0);
  await owner.getByRole("tab", { name: "Approved" }).click();
  await expect(
    owner.getByRole("button", { name: `Mark as returned: ${name}` }),
  ).toBeVisible();

  await expect(row.getByRole("link", { name: /@/ })).toBeVisible();

  await confirm(owner, `Mark as returned: ${name}`, "Yes, it is back");
  await expect(row.getByText("Returned", { exact: true })).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);
  await removeListing(owner, name);
});

test("an owner can decline, and a borrower sees it", async ({ open }) => {
  const owner = await open("owner");
  const borrower = await open("borrower");
  const name = uniqueName("Tent");
  await listTool(owner, name);
  await requestTool(borrower, name);

  await owner.goto("/incoming");
  await confirm(owner, `Decline: ${name}`, "Yes, decline");

  await borrower.goto("/requests");
  await expect(
    borrower
      .getByRole("listitem")
      .filter({ hasText: name })
      .getByText("Declined", { exact: true }),
  ).toBeVisible();
  await removeListing(owner, name);
});

test("a borrower can cancel, and the owner no longer has anything to answer", async ({
  open,
}) => {
  const owner = await open("owner");
  const borrower = await open("borrower");
  const name = uniqueName("Mixer");
  await listTool(owner, name);
  await requestTool(borrower, name);

  await borrower.goto("/requests");
  await confirm(borrower, `Cancel request: ${name}`, "Yes, cancel it");

  await owner.goto("/incoming");
  await dataLoaded(owner);
  await expect(
    owner.getByRole("button", { name: `Approve: ${name}` }),
  ).toHaveCount(0);
  await removeListing(owner, name);
});

test("nobody is offered a loan on their own tool", async ({ open }) => {
  const owner = await open("owner");
  const name = uniqueName("Drill");
  await listTool(owner, name);
  await owner.goto("/board");
  await owner.getByRole("heading", { name }).waitFor();
  await expect(
    owner.getByRole("button", { name: `Request to borrow: ${name}` }),
  ).toHaveCount(0);
  await removeListing(owner, name);
});

test("an admin removes another person's listing, and it leaves the board", async ({
  open,
}) => {
  const owner = await open("owner");
  const admin = await open("admin");
  const name = uniqueName("Saw");
  await listTool(owner, name);

  await admin.goto("/board");
  await admin.getByRole("heading", { name }).waitFor();
  await expect(admin.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await admin.goto("/admin?tab=listings");
  await confirm(admin, `Remove: ${name}`, "Yes, remove");
  await expect(admin.getByRole("rowheader", { name })).toHaveCount(0);
  await admin.goto("/board");
  await dataLoaded(admin);
  await expect(admin.getByRole("heading", { name })).toHaveCount(0);
  await owner.goto("/listings");
  await dataLoaded(owner);
  await expect(owner.getByRole("heading", { name })).toHaveCount(0);
});

test("an admin marks a Trusted Lender, and neighbors see the badge", async ({
  open,
}) => {
  const owner = await open("owner");
  const admin = await open("admin");
  const name = uniqueName("Hose");
  await listTool(owner, name);

  await admin.goto("/admin?tab=people");
  const trusted = admin.getByRole("switch", {
    name: "Trusted Lender: Olu Owner",
  });
  await expect(trusted).toBeVisible();
  if (await trusted.isChecked()) {
    await trusted.click();
    await expect(trusted).not.toBeChecked();
  }
  await trusted.click();
  await expect(trusted).toBeChecked();

  const borrower = await open("borrower");
  await borrower.goto("/board");
  await expect(
    borrower
      .getByRole("listitem")
      .filter({ hasText: name })
      .getByText("Trusted Lender"),
  ).toBeVisible();

  await trusted.click();
  await expect(trusted).not.toBeChecked();
  await removeListing(owner, name);
});

test("a plain user sees no Admin link, and the admin page refuses them", async ({
  open,
}) => {
  const borrower = await open("borrower");
  await borrower.goto("/admin");
  await expect(
    borrower.getByText("This page is for admins only."),
  ).toBeVisible();
  await expect(borrower.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(borrower.getByRole("heading", { name: "People" })).toHaveCount(
    0,
  );
});

test("an admin moves between tabs, and a link opens the right one", async ({
  open,
}) => {
  const admin = await open("admin");
  await admin.goto("/admin");
  await expect(admin.getByRole("tab", { name: "Listings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await admin.getByRole("tab", { name: "People" }).click();
  await expect(admin).toHaveURL(/tab=people/);
  await admin.reload();
  await expect(admin.getByRole("tab", { name: "People" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await admin.goto("/admin?tab=failures");
  await expect(admin.getByRole("tab", { name: "Failures" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("the Admin link sits apart from the main nav", async ({ open }) => {
  const admin = await open("admin");
  await admin.goto("/board");
  await expect(
    admin.getByRole("navigation", { name: "Admin" }).getByRole("link"),
  ).toHaveText("Admin");
  await expect(
    admin
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Admin" }),
  ).toHaveCount(0);
});

test("incoming opens the tab named in the URL", async ({ open }) => {
  const owner = await open("owner");
  await owner.goto("/incoming?tab=past");
  await expect(owner.getByRole("tab", { name: "Past" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("Load more brings the older rows on a long list", async ({ open }) => {
  await exec("npx", ["convex", "run", "seed:toolsForPaging"]);
  try {
    const admin = await open("admin");
    await admin.goto("/admin?tab=listings");
    const rows = admin.getByRole("rowheader");
    await expect(rows).toHaveCount(24);
    await admin.getByRole("button", { name: "Load more tools" }).click();
    await expect.poll(() => rows.count()).toBeGreaterThan(24);
  } finally {
    await exec("npx", ["convex", "run", "seed:removeToolsForPaging"]);
  }
});
