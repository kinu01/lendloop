import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  expectCode,
  makeUser,
  setup,
  tool,
  PAGE,
  PAGE_ONLY,
} from "./test.helpers";

afterEach(() => vi.useRealTimers());

describe("admin", () => {
  test("an admin sees every loan", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const admin = await makeUser(t, { role: "admin" });
    const toolId = await owner.as.mutation(api.tools.create, tool());
    await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: "2026-06-16",
      endDate: "2026-06-17",
    });
    expect(
      (await admin.as.query(api.admin.listAllLoans, PAGE)).page,
    ).toHaveLength(1);
  });

  test("an admin lists active tools, with the owner's first name and no email", async () => {
    const t = setup();
    const owner = await makeUser(t, { name: "Olu Owner" });
    const admin = await makeUser(t, { role: "admin" });
    await owner.as.mutation(api.tools.create, tool({ name: "Kept" }));
    const gone = await owner.as.mutation(api.tools.create, tool());
    await owner.as.mutation(api.tools.remove, { toolId: gone });
    const { page } = await admin.as.query(api.admin.listTools, PAGE);
    expect(page.map((row) => row.name)).toEqual(["Kept"]);
    expect(page[0]).toMatchObject({
      ownerFirstName: "Olu",
      availability: "available",
    });
    expect(JSON.stringify(page)).not.toContain("@");
  });

  test("an admin sees automation failures, including ones without a loan", async () => {
    const t = setup();
    const admin = await makeUser(t, { role: "admin" });
    await t.mutation(internal.automation.recordFailure, {
      workflow: "LendLoop: overdue reminders",
      executionId: "7",
      message: "timeout",
    });
    const failures = (
      await admin.as.query(api.admin.listAutomationFailures, PAGE_ONLY)
    ).page;
    expect(failures).toHaveLength(1);
    expect(failures[0]!.toolName).toBeNull();
    expect(failures[0]).toMatchObject({
      workflow: "LendLoop: overdue reminders",
      executionId: "7",
      message: "timeout",
    });
  });

  test("a user gets FORBIDDEN on every admin function", async () => {
    const t = setup();
    const user = await makeUser(t);
    await expectCode(
      user.as.query(api.admin.listAutomationFailures, PAGE_ONLY),
      "FORBIDDEN",
    );
    await expectCode(user.as.query(api.admin.listAllLoans, PAGE), "FORBIDDEN");
    await expectCode(
      user.as.query(api.admin.listUsers, PAGE_ONLY),
      "FORBIDDEN",
    );
    await expectCode(
      user.as.mutation(api.admin.setTrustedLender, {
        userId: user.id,
        trusted: true,
      }),
      "FORBIDDEN",
    );
  });

  test("signed-out callers get UNAUTHENTICATED", async () => {
    const t = setup();
    await expectCode(t.query(api.admin.listAllLoans, PAGE), "UNAUTHENTICATED");
  });

  test("an admin can mark and unmark a Trusted Lender", async () => {
    const t = setup();
    const lender = await makeUser(t);
    const admin = await makeUser(t, { role: "admin" });
    await admin.as.mutation(api.admin.setTrustedLender, {
      userId: lender.id,
      trusted: true,
    });
    expect((await lender.as.query(api.users.me, {})).isTrustedLender).toBe(
      true,
    );
    await admin.as.mutation(api.admin.setTrustedLender, {
      userId: lender.id,
      trusted: false,
    });
    expect((await lender.as.query(api.users.me, {})).isTrustedLender).toBe(
      false,
    );
  });

  test("lists a notification out of attempts and a failed reminder, and nothing that recovered", async () => {
    const t = setup();
    const admin = await makeUser(t, { role: "admin" });
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: "2026-06-16",
      endDate: "2026-06-17",
    });
    const failed = {
      loanId,
      event: "created" as const,
      status: "failed" as const,
      problem: "http_error" as const,
      httpStatus: 503,
    };
    await t.mutation(internal.automation.recordNotification, {
      ...failed,
      attempt: 1,
      willRetry: true,
    });
    await t.mutation(internal.automation.recordNotification, {
      loanId,
      event: "created",
      status: "sent",
      attempt: 2,
      willRetry: false,
    });
    await t.mutation(internal.automation.recordNotification, {
      ...failed,
      attempt: 4,
      willRetry: false,
    });
    await t.mutation(internal.reminders.record, {
      loanId,
      reminderDate: "2026-06-18",
      status: "failed",
      runId: "run",
    });
    const { page } = await admin.as.query(api.admin.listAutomationFailures, {
      ...PAGE_ONLY,
    });
    expect(page).toHaveLength(2);
    expect(page[0]).toMatchObject({
      workflow: "LendLoop: overdue reminders",
      executionId: null,
    });
    expect(page[1]).toMatchObject({
      workflow: "LendLoop: request notification",
      executionId: null,
      message:
        "The created notification was not sent after 4 attempts: n8n answered HTTP 503.",
    });
  });
});
