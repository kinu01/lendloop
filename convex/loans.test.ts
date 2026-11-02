import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  expectCode,
  insertLoan,
  insertTool,
  makeUser,
  setup,
  tool,
  TODAY,
  type T,
  PAGE,
  allIncoming,
} from "./test.helpers";

afterEach(() => vi.useRealTimers());

async function scene(t: T) {
  const owner = await makeUser(t);
  const borrower = await makeUser(t);
  const stranger = await makeUser(t);
  const toolId = await owner.as.mutation(api.tools.create, tool());
  return { owner, borrower, stranger, toolId };
}

async function pendingLoan(t: T) {
  const s = await scene(t);
  const loanId = await s.borrower.as.mutation(api.loans.request, {
    toolId: s.toolId,
    startDate: "2026-06-16",
    endDate: "2026-06-18",
  });
  return { ...s, loanId };
}

function status(t: T, loanId: Id<"loans">) {
  return t.run(async (ctx) => (await ctx.db.get("loans", loanId))?.status);
}

function scheduled(t: T) {
  return t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

describe("loans.request", () => {
  test("creates a pending loan and schedules one notification", async () => {
    const t = setup();
    const { loanId } = await pendingLoan(t);
    expect(await status(t, loanId)).toBe("pending");
    const jobs = await scheduled(t);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.name).toBe("notify:sendRequestEvent");
    expect(jobs[0]!.args[0]).toMatchObject({ loanId, event: "created" });
  });

  test("requires sign-in", async () => {
    const t = setup();
    const { toolId } = await scene(t);
    await expectCode(
      t.mutation(api.loans.request, {
        toolId,
        startDate: TODAY,
        endDate: TODAY,
      }),
      "UNAUTHENTICATED",
    );
  });

  test("rejects borrowing your own tool", async () => {
    const t = setup();
    const { owner, toolId } = await scene(t);
    await expectCode(
      owner.as.mutation(api.loans.request, {
        toolId,
        startDate: TODAY,
        endDate: TODAY,
      }),
      "INVALID",
    );
  });

  test.each([
    ["a past start date", "2026-06-13", "2026-06-16"],
    ["an end before the start", "2026-06-18", "2026-06-16"],
    ["an impossible date", "2026-06-31", "2026-07-01"],
    ["a badly shaped date", "15/06/2026", "2026-06-16"],
  ])("rejects %s", async (_, startDate, endDate) => {
    const t = setup();
    const { borrower, toolId } = await scene(t);
    await expectCode(
      borrower.as.mutation(api.loans.request, { toolId, startDate, endDate }),
      "INVALID",
    );
  });

  test("accepts a long loan, because the owner decides", async () => {
    const t = setup();
    const { borrower, toolId } = await scene(t);
    await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: "2026-06-15",
      endDate: "2027-06-14",
    });
  });

  test("rejects dates that overlap an approved loan", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await scene(t);
    await insertLoan(t, {
      toolId,
      borrowerId: stranger.id,
      ownerId: owner.id,
      startDate: "2026-06-16",
      endDate: "2026-06-20",
      status: "approved",
    });
    await expectCode(
      borrower.as.mutation(api.loans.request, {
        toolId,
        startDate: "2026-06-20",
        endDate: "2026-06-22",
      }),
      "INVALID",
    );
  });

  test("rejects a second pending request for the same tool", async () => {
    const t = setup();
    const { borrower, toolId } = await pendingLoan(t);
    await expectCode(
      borrower.as.mutation(api.loans.request, {
        toolId,
        startDate: "2026-06-25",
        endDate: "2026-06-26",
      }),
      "INVALID",
    );
  });
});

describe("open request limit", () => {
  test("a borrower cannot hold more than 20 pending requests", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const dates = { startDate: "2026-06-16", endDate: "2026-06-17" };
    for (let i = 0; i < 20; i += 1) {
      await insertLoan(t, {
        toolId: await insertTool(t, owner.id),
        borrowerId: borrower.id,
        ownerId: owner.id,
        status: "pending",
        ...dates,
      });
    }
    const extra = await insertTool(t, owner.id);
    await expectCode(
      borrower.as.mutation(api.loans.request, { toolId: extra, ...dates }),
      "INVALID",
    );
  });
});

describe("double booking", () => {
  test("of two overlapping requests, only the first approval succeeds", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await scene(t);
    const dates = { startDate: "2026-06-16", endDate: "2026-06-18" };
    const first = await borrower.as.mutation(api.loans.request, {
      toolId,
      ...dates,
    });
    const second = await stranger.as.mutation(api.loans.request, {
      toolId,
      ...dates,
    });
    await owner.as.mutation(api.loans.approve, { loanId: first });
    await expectCode(
      owner.as.mutation(api.loans.approve, { loanId: second }),
      "INVALID",
    );
    const rows = await t.run((ctx) => ctx.db.query("loans").collect());
    expect(rows.filter((row) => row.status === "approved")).toHaveLength(1);
  });
});

describe("request rate limit", () => {
  test("request then cancel cannot repeat without limit, because each one notifies the owner", async () => {
    const t = setup();
    const { borrower, toolId } = await scene(t);
    const dates = { toolId, startDate: "2026-06-16", endDate: "2026-06-17" };
    for (let i = 0; i < 10; i += 1) {
      const loanId = await borrower.as.mutation(api.loans.request, dates);
      await borrower.as.mutation(api.loans.cancel, { loanId });
    }
    await expectCode(
      borrower.as.mutation(api.loans.request, dates),
      "RATE_LIMITED",
    );
  });
});

describe("the past group on incoming", () => {
  test("pages only through closed loans, most recently closed first", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await scene(t);
    const base = {
      toolId,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: TODAY,
      endDate: TODAY,
    };
    const closed = [];
    for (let i = 0; i < 3; i += 1) {
      closed.push(
        await t.run((ctx) =>
          ctx.db.insert("loans", {
            ...base,
            status: "returned",
            closedAt: 1000 + i,
          }),
        ),
      );
      await insertLoan(t, { ...base, status: "pending" });
    }
    const first = await owner.as.query(api.loans.incoming, {
      today: TODAY,
      group: "past",
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((l) => l._id)).toEqual([closed[2], closed[1]]);
    const second = await owner.as.query(api.loans.incoming, {
      today: TODAY,
      group: "past",
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((l) => l._id)).toEqual([closed[0]]);
  });

  test("closing a loan through a mutation puts it in the past group", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await scene(t);
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: "2026-06-16",
      endDate: "2026-06-17",
    });
    await owner.as.mutation(api.loans.decline, { loanId });
    const past = await owner.as.query(api.loans.incoming, {
      ...PAGE,
      group: "past",
    });
    expect(past.page.map((l) => l._id)).toEqual([loanId]);
  });
});

describe("incoming groups", () => {
  test("each group holds its own loans, and approved runs oldest end date first", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await scene(t);
    const base = { toolId, ownerId: owner.id };
    await insertLoan(t, {
      ...base,
      borrowerId: borrower.id,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      status: "approved",
    });
    await insertLoan(t, {
      ...base,
      borrowerId: stranger.id,
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      status: "approved",
    });
    await insertLoan(t, {
      ...base,
      borrowerId: stranger.id,
      startDate: "2026-06-16",
      endDate: "2026-06-16",
      status: "pending",
    });
    await insertLoan(t, {
      ...base,
      borrowerId: stranger.id,
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      status: "returned",
    });
    const read = (group: "pending" | "approved" | "past") =>
      owner.as
        .query(api.loans.incoming, { group, ...PAGE })
        .then((r) => r.page);
    expect((await read("approved")).map((l) => l.endDate)).toEqual([
      "2026-06-02",
      "2026-06-21",
    ]);
    expect((await read("pending")).map((l) => l.status)).toEqual(["pending"]);
    expect((await read("past")).map((l) => l.status)).toEqual(["returned"]);
  });
});

describe("loans.approve and loans.decline", () => {
  test.each(["approve", "decline"] as const)(
    "the owner can %s",
    async (action) => {
      const t = setup();
      const { owner, loanId } = await pendingLoan(t);
      await owner.as.mutation(api.loans[action], { loanId });
      expect(await status(t, loanId)).toBe(
        action === "approve" ? "approved" : "declined",
      );
      const jobs = await scheduled(t);
      expect(jobs.at(-1)?.args[0]).toMatchObject({
        event: action === "approve" ? "approved" : "declined",
      });
    },
  );

  test.each(["approve", "decline"] as const)(
    "the borrower and a stranger cannot %s",
    async (action) => {
      const t = setup();
      const { borrower, stranger, loanId } = await pendingLoan(t);
      for (const caller of [borrower, stranger]) {
        await expectCode(
          caller.as.mutation(api.loans[action], { loanId }),
          "FORBIDDEN",
        );
      }
    },
  );

  test("an admin who is not the owner cannot approve", async () => {
    const t = setup();
    const { loanId } = await pendingLoan(t);
    const admin = await makeUser(t, { role: "admin" });
    await expectCode(
      admin.as.mutation(api.loans.approve, { loanId }),
      "FORBIDDEN",
    );
  });

  test("a request that is not pending cannot be approved or declined", async () => {
    const t = setup();
    const { owner, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.decline, { loanId });
    await expectCode(
      owner.as.mutation(api.loans.approve, { loanId }),
      "INVALID",
    );
    await expectCode(
      owner.as.mutation(api.loans.decline, { loanId }),
      "INVALID",
    );
  });

  test("an expired request cannot be approved", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await scene(t);
    const loanId = await insertLoan(t, {
      toolId,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      status: "pending",
    });
    await expectCode(
      owner.as.mutation(api.loans.approve, { loanId }),
      "INVALID",
    );
  });

  test("approving a request that overlaps an approved loan fails", async () => {
    const t = setup();
    const { owner, stranger, toolId, loanId } = await pendingLoan(t);
    const other = await stranger.as.mutation(api.loans.request, {
      toolId,
      startDate: "2026-06-17",
      endDate: "2026-06-19",
    });
    await owner.as.mutation(api.loans.approve, { loanId: other });
    await expectCode(
      owner.as.mutation(api.loans.approve, { loanId }),
      "INVALID",
    );
  });
});

describe("loans.cancel", () => {
  test("the borrower can cancel a pending request; the owner is notified", async () => {
    const t = setup();
    const { borrower, loanId } = await pendingLoan(t);
    await borrower.as.mutation(api.loans.cancel, { loanId });
    expect(await status(t, loanId)).toBe("cancelled");
    expect((await scheduled(t)).at(-1)?.args[0]).toMatchObject({
      event: "cancelled",
    });
  });

  test("the owner and a stranger cannot cancel", async () => {
    const t = setup();
    const { owner, stranger, loanId } = await pendingLoan(t);
    for (const caller of [owner, stranger]) {
      await expectCode(
        caller.as.mutation(api.loans.cancel, { loanId }),
        "FORBIDDEN",
      );
    }
  });

  test("the borrower can cancel an approved loan until it starts", async () => {
    const t = setup();
    const { owner, borrower, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    await borrower.as.mutation(api.loans.cancel, { loanId });
    expect(await status(t, loanId)).toBe("cancelled");
  });

  test("the owner can decline an approved loan until it starts", async () => {
    const t = setup();
    const { owner, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    await owner.as.mutation(api.loans.decline, { loanId });
    expect(await status(t, loanId)).toBe("declined");
  });

  test("a loan that has started cannot be cancelled or declined", async () => {
    const t = setup();
    const { owner, borrower, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    vi.setSystemTime(new Date("2026-06-16T10:00:00Z"));
    await expectCode(
      borrower.as.mutation(api.loans.cancel, { loanId }),
      "INVALID",
    );
    await expectCode(
      owner.as.mutation(api.loans.decline, { loanId }),
      "INVALID",
    );
  });
});

describe("loans.markReturned", () => {
  test("the owner can mark an approved loan returned", async () => {
    const t = setup();
    const { owner, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    vi.setSystemTime(new Date("2026-06-16T10:00:00Z"));
    await owner.as.mutation(api.loans.markReturned, { loanId });
    expect(await status(t, loanId)).toBe("returned");
  });

  test("the borrower and a stranger cannot mark it returned", async () => {
    const t = setup();
    const { owner, borrower, stranger, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    vi.setSystemTime(new Date("2026-06-16T10:00:00Z"));
    for (const caller of [borrower, stranger]) {
      await expectCode(
        caller.as.mutation(api.loans.markReturned, { loanId }),
        "FORBIDDEN",
      );
    }
  });

  test("a loan that has not started cannot be marked returned", async () => {
    const t = setup();
    const { owner, loanId } = await pendingLoan(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    await expectCode(
      owner.as.mutation(api.loans.markReturned, { loanId }),
      "INVALID",
    );
    const [row] = await allIncoming(owner.as);
    expect(row!.hasStarted).toBe(false);
  });

  test("contact details appear only on an approved loan, for its two people", async () => {
    const t = setup();
    const { owner, borrower, loanId } = await pendingLoan(t);
    const admin = await makeUser(t, { role: "admin" });
    const contact = async () => ({
      borrowerSees: (await borrower.as.query(api.loans.myRequests, PAGE))
        .page[0]!.contactEmail,
      ownerSees: (await allIncoming(owner.as))[0]!.contactEmail,
    });
    expect(await contact()).toEqual({ borrowerSees: null, ownerSees: null });

    await owner.as.mutation(api.loans.approve, { loanId });
    expect(await contact()).toEqual({
      borrowerSees: owner.email,
      ownerSees: borrower.email,
    });
    const [adminRow] = (await admin.as.query(api.admin.listAllLoans, PAGE))
      .page;
    expect(adminRow!.contactEmail).toBeNull();

    vi.setSystemTime(new Date("2026-06-16T10:00:00Z"));
    await owner.as.mutation(api.loans.markReturned, { loanId });
    expect(await contact()).toEqual({ borrowerSees: null, ownerSees: null });
  });

  test("waitingCount counts only the caller's pending requests", async () => {
    const t = setup();
    const { owner, borrower, loanId } = await pendingLoan(t);
    expect(await owner.as.query(api.loans.waitingCount, {})).toBe(1);
    expect(await borrower.as.query(api.loans.waitingCount, {})).toBe(0);
    await owner.as.mutation(api.loans.decline, { loanId });
    expect(await owner.as.query(api.loans.waitingCount, {})).toBe(0);
    await expectCode(t.query(api.loans.waitingCount, {}), "UNAUTHENTICATED");
  });

  test("waitingCount reports one past its limit, so the page can say 100+", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await scene(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 150; i += 1) {
        await ctx.db.insert("loans", {
          toolId,
          borrowerId: borrower.id,
          ownerId: owner.id,
          startDate: TODAY,
          endDate: TODAY,
          status: "pending",
        });
      }
    });
    expect(await owner.as.query(api.loans.waitingCount, {})).toBe(101);
  });

  test("waitingCount still finds a pending request older than 100 other loans", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await pendingLoan(t);
    for (let i = 0; i < 100; i += 1) {
      await insertLoan(t, {
        toolId,
        borrowerId: borrower.id,
        ownerId: owner.id,
        startDate: TODAY,
        endDate: TODAY,
        status: "returned",
      });
    }
    expect(await owner.as.query(api.loans.waitingCount, {})).toBe(1);
  });

  test("loan lists carry the latest automation event", async () => {
    const t = setup();
    const { borrower, loanId } = await pendingLoan(t);
    await t.run((ctx) =>
      ctx.db.insert("automationEvents", {
        loanId,
        kind: "notification",
        event: "created",
        status: "sent",
        attempt: 1,
        willRetry: false,
      }),
    );
    const [row] = (await borrower.as.query(api.loans.myRequests, PAGE)).page;
    expect(row!.latestActivity).toMatchObject({
      kind: "notification",
      event: "created",
      status: "sent",
    });
  });

  test("a pending request cannot be marked returned", async () => {
    const t = setup();
    const { owner, loanId } = await pendingLoan(t);
    await expectCode(
      owner.as.mutation(api.loans.markReturned, { loanId }),
      "INVALID",
    );
  });
});

describe("loan views", () => {
  test("myRequests and incoming return only the caller's loans", async () => {
    const t = setup();
    const { owner, borrower, stranger, loanId } = await pendingLoan(t);
    expect(
      (await borrower.as.query(api.loans.myRequests, PAGE)).page.map(
        (l) => l._id,
      ),
    ).toEqual([loanId]);
    expect((await allIncoming(owner.as)).map((l) => l._id)).toEqual([loanId]);
    expect((await stranger.as.query(api.loans.myRequests, PAGE)).page).toEqual(
      [],
    );
    expect(await allIncoming(stranger.as)).toEqual([]);
    expect(await allIncoming(borrower.as)).toEqual([]);
  });

  test("views require sign-in", async () => {
    const t = setup();
    await expectCode(t.query(api.loans.myRequests, PAGE), "UNAUTHENTICATED");
    await expectCode(allIncoming(t), "UNAUTHENTICATED");
  });

  test("activity is visible to the borrower, the owner and an admin only", async () => {
    const t = setup();
    const { owner, borrower, stranger, loanId } = await pendingLoan(t);
    const admin = await makeUser(t, { role: "admin" });
    await t.run((ctx) =>
      ctx.db.insert("automationEvents", {
        loanId,
        kind: "reminder",
        status: "sent",
      }),
    );
    for (const caller of [owner, borrower, admin]) {
      const events = await caller.as.query(api.loans.activity, { loanId });
      expect(events.map((e) => e.kind)).toEqual(["reminder"]);
    }
    await expectCode(
      stranger.as.query(api.loans.activity, { loanId }),
      "FORBIDDEN",
    );
  });
});
