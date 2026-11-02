import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  expectCode,
  insertLoan,
  insertTool,
  makeUser,
  setup,
  tool,
  TODAY,
  PAGE,
  allIncoming,
} from "./test.helpers";

afterEach(() => vi.useRealTimers());

describe("tools.listPublic", () => {
  test("works signed out and returns only name and category", async () => {
    const t = setup();
    const owner = await makeUser(t);
    await owner.as.mutation(api.tools.create, tool());
    const { tools: list } = await t.query(api.tools.listPublic, {
      today: TODAY,
    });
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0]!).sort()).toEqual(["_id", "category", "name"]);
  });

  test("hides removed tools and tools on loan", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const removed = await owner.as.mutation(api.tools.create, tool());
    await owner.as.mutation(api.tools.remove, { toolId: removed });
    const lent = await owner.as.mutation(api.tools.create, tool());
    await insertLoan(t, {
      toolId: lent,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: TODAY,
      endDate: TODAY,
      status: "approved",
    });
    await owner.as.mutation(api.tools.create, tool({ name: "Rake" }));
    const { tools: list } = await t.query(api.tools.listPublic, {
      today: TODAY,
    });
    expect(list.map((x) => x.name)).toEqual(["Rake"]);
  });
});

describe("tools.listPublic bounds", () => {
  test("returns at most the newest 24 available tools, skipping tools on loan", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    for (let i = 0; i < 30; i += 1) {
      await insertTool(t, owner.id, `Tool ${i}`);
    }
    const lent = await insertTool(t, owner.id, "Newest but lent");
    await insertLoan(t, {
      toolId: lent,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: TODAY,
      endDate: TODAY,
      status: "approved",
    });
    const { tools: list } = await t.query(api.tools.listPublic, {
      today: TODAY,
    });
    expect(list).toHaveLength(24);
    expect(list[0]!.name).toBe("Tool 29");
    expect(list.map((x) => x.name)).not.toContain("Newest but lent");
  });
});

describe("tools.listPublic hasMore", () => {
  test.each([
    [24, false],
    [25, true],
  ])("with %i available tools, hasMore is %s", async (count, hasMore) => {
    const t = setup();
    const owner = await makeUser(t);
    for (let i = 0; i < count; i += 1) {
      await insertTool(t, owner.id, `Tool ${i}`);
    }
    const result = await t.query(api.tools.listPublic, { today: TODAY });
    expect(result.tools).toHaveLength(24);
    expect(result.hasMore).toBe(hasMore);
  });
});

describe("the today argument", () => {
  test("availability follows the date the caller passes, not the clock", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const toolId = await insertTool(t, owner.id, "Booked");
    await insertLoan(t, {
      toolId,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: "2026-06-16",
      endDate: "2026-06-18",
      status: "approved",
    });
    const onDay = async (today: string) => {
      const { page } = await borrower.as.query(api.tools.list, {
        ...PAGE,
        today,
      });
      return page[0]!.availability;
    };
    expect(await onDay("2026-06-15")).toBe("available");
    expect(await onDay("2026-06-16")).toBe("on_loan");
    const { tools: open } = await t.query(api.tools.listPublic, {
      today: "2026-06-15",
    });
    const { tools: closed } = await t.query(api.tools.listPublic, {
      today: "2026-06-16",
    });
    expect(open).toHaveLength(1);
    expect(closed).toHaveLength(0);
  });

  test("the public list refuses a date far from today, which would show tools on loan", async () => {
    const t = setup();
    for (const today of ["2020-01-01", "2026-06-13", "2026-06-17"]) {
      await expectCode(t.query(api.tools.listPublic, { today }), "INVALID");
    }
    await t.query(api.tools.listPublic, { today: "2026-06-14" });
    await t.query(api.tools.listPublic, { today: "2026-06-16" });
  });

  test("a malformed date is rejected", async () => {
    const t = setup();
    await expectCode(
      t.query(api.tools.listPublic, { today: "yesterday" }),
      "INVALID",
    );
  });
});

describe("removing a tool closes its future bookings", () => {
  test("an admin removal declines unstarted loans and leaves a started one open", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const admin = await makeUser(t, { role: "admin" });
    const toolId = await insertTool(t, owner.id);
    const base = { toolId, borrowerId: borrower.id, ownerId: owner.id };
    const started = await insertLoan(t, {
      ...base,
      startDate: TODAY,
      endDate: "2026-06-16",
      status: "approved",
    });
    const future = await insertLoan(t, {
      ...base,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      status: "approved",
    });
    const pending = await insertLoan(t, {
      ...base,
      startDate: "2026-06-25",
      endDate: "2026-06-26",
      status: "pending",
    });
    await admin.as.mutation(api.tools.remove, { toolId });
    const [startedRow, futureRow, pendingRow, jobs] = await t.run(
      async (ctx) => [
        await ctx.db.get("loans", started),
        await ctx.db.get("loans", future),
        await ctx.db.get("loans", pending),
        await ctx.db.system.query("_scheduled_functions").collect(),
      ],
    );
    expect(startedRow?.status).toBe("approved");
    expect(futureRow?.status).toBe("declined");
    expect(pendingRow?.status).toBe("declined");
    expect(jobs.map((job) => job.args[0].loanId).sort()).toEqual(
      [future, pending].sort(),
    );
  });
});

describe("tool names", () => {
  test.each(["Saw\n[mock reminder] forged", "Saw\tblade", "Saw\u0007"])(
    "refuses a control character: %j",
    async (name) => {
      const t = setup();
      const owner = await makeUser(t);
      await expectCode(
        owner.as.mutation(api.tools.create, tool({ name })),
        "INVALID",
      );
    },
  );

  test("an edit cannot add one either", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    await expectCode(
      owner.as.mutation(api.tools.update, {
        toolId,
        ...tool({ name: "Saw\nforged" }),
      }),
      "INVALID",
    );
  });

  test("ordinary punctuation and accents are fine", async () => {
    const t = setup();
    const owner = await makeUser(t);
    await owner.as.mutation(
      api.tools.create,
      tool({ name: "Bosch 18V drill (Émile's) - 2nd" }),
    );
  });
});

describe("rate limits", () => {
  test("listing tools too quickly is refused", async () => {
    const t = setup();
    const owner = await makeUser(t);
    for (let i = 0; i < 20; i += 1) {
      await owner.as.mutation(api.tools.create, tool());
    }
    await expectCode(
      owner.as.mutation(api.tools.create, tool()),
      "RATE_LIMITED",
    );
  });
});

describe("tools.list", () => {
  test("requires sign-in", async () => {
    const t = setup();
    await expectCode(t.query(api.tools.list, PAGE), "UNAUTHENTICATED");
  });

  test("shows availability and filters by category, without owner email", async () => {
    const t = setup();
    const owner = await makeUser(t, { name: "Ada Lovelace", trusted: true });
    const borrower = await makeUser(t);
    const drill = await owner.as.mutation(api.tools.create, tool());
    await owner.as.mutation(
      api.tools.create,
      tool({ name: "Rake", category: "garden" }),
    );
    await insertLoan(t, {
      toolId: drill,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: TODAY,
      endDate: TODAY,
      status: "approved",
    });

    const all = (await borrower.as.query(api.tools.list, PAGE)).page;
    expect(all.find((x) => x.name === "Cordless drill")).toMatchObject({
      availability: "on_loan",
      dueBack: TODAY,
      ownerFirstName: "Ada",
      ownerIsTrustedLender: true,
      isMine: false,
    });
    expect(JSON.stringify(all)).not.toContain(owner.email);

    const garden = (
      await borrower.as.query(api.tools.list, { category: "garden", ...PAGE })
    ).page;
    expect(garden.map((x) => x.name)).toEqual(["Rake"]);
  });

  test("a future approved loan shows as the next booking", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const drill = await owner.as.mutation(api.tools.create, tool());
    for (const [startDate, endDate] of [
      ["2026-06-25", "2026-06-26"],
      ["2026-06-20", "2026-06-21"],
    ]) {
      await insertLoan(t, {
        toolId: drill,
        borrowerId: borrower.id,
        ownerId: owner.id,
        startDate: startDate!,
        endDate: endDate!,
        status: "approved",
      });
    }
    const [item] = (await borrower.as.query(api.tools.list, PAGE)).page;
    expect(item!.nextBooking).toEqual({
      startDate: "2026-06-20",
      endDate: "2026-06-21",
    });
  });

  test("each caller sees only their own pending request, and every booking", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const asker = await makeUser(t);
    const other = await makeUser(t);
    const drill = await owner.as.mutation(api.tools.create, tool());
    await asker.as.mutation(api.loans.request, {
      toolId: drill,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
    });
    await insertLoan(t, {
      toolId: drill,
      borrowerId: other.id,
      ownerId: owner.id,
      startDate: "2026-06-25",
      endDate: "2026-06-26",
      status: "approved",
    });
    const [forAsker] = (await asker.as.query(api.tools.list, PAGE)).page;
    const [forOther] = (await other.as.query(api.tools.list, PAGE)).page;
    expect(forAsker!.myPendingRequest).toEqual({
      startDate: "2026-06-20",
      endDate: "2026-06-21",
    });
    expect(forOther!.myPendingRequest).toBeNull();
    expect(forAsker!.bookings).toEqual([
      { startDate: "2026-06-25", endDate: "2026-06-26" },
    ]);
  });

  test("a future approved loan does not mark the tool on loan today", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const drill = await owner.as.mutation(api.tools.create, tool());
    await insertLoan(t, {
      toolId: drill,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      status: "approved",
    });
    const [item] = (await borrower.as.query(api.tools.list, PAGE)).page;
    expect(item!.availability).toBe("available");
  });
});

describe("pagination", () => {
  test("every tool is reachable through the cursor, past any one page", async () => {
    const t = setup();
    const a = await makeUser(t);
    const b = await makeUser(t);
    for (const owner of [a, b]) {
      for (let i = 0; i < 30; i += 1) {
        await insertTool(t, owner.id, `Tool ${i}`);
      }
    }
    const seen = new Set<string>();
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const result: {
        page: { _id: string }[];
        isDone: boolean;
        continueCursor: string;
      } = await a.as.query(api.tools.list, {
        today: TODAY,
        paginationOpts: { numItems: 25, cursor },
      });
      for (const item of result.page) seen.add(item._id);
      cursor = result.continueCursor;
      done = result.isDone;
    }
    expect(seen.size).toBe(60);
  });
});

describe("per-user limits", () => {
  test("a user cannot list more than 50 tools, and removing one frees a place", async () => {
    const t = setup();
    const owner = await makeUser(t);
    let last = await insertTool(t, owner.id);
    for (let i = 1; i < 50; i += 1) {
      last = await insertTool(t, owner.id);
    }
    await expectCode(owner.as.mutation(api.tools.create, tool()), "INVALID");
    await owner.as.mutation(api.tools.remove, { toolId: last });
    await owner.as.mutation(api.tools.create, tool());
  });
});

describe("tools.myListings", () => {
  test("returns only the caller's tools", async () => {
    const t = setup();
    const a = await makeUser(t);
    const b = await makeUser(t);
    await a.as.mutation(api.tools.create, tool({ name: "Mine" }));
    await b.as.mutation(api.tools.create, tool({ name: "Theirs" }));
    const mine = (await a.as.query(api.tools.myListings, PAGE)).page;
    expect(mine.map((x) => x.name)).toEqual(["Mine"]);
  });
});

describe("tools.create", () => {
  test("requires sign-in", async () => {
    const t = setup();
    await expectCode(t.mutation(api.tools.create, tool()), "UNAUTHENTICATED");
  });

  test("trims input and sets the caller as owner", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const id = await owner.as.mutation(
      api.tools.create,
      tool({ name: "  Saw  " }),
    );
    const saved = await t.run((ctx) => ctx.db.get("tools", id));
    expect(saved).toMatchObject({ name: "Saw", ownerId: owner.id });
  });

  test("rejects an empty name and a long description", async () => {
    const t = setup();
    const owner = await makeUser(t);
    await expectCode(
      owner.as.mutation(api.tools.create, tool({ name: "   " })),
      "INVALID",
    );
    await expectCode(
      owner.as.mutation(
        api.tools.create,
        tool({ description: "x".repeat(501) }),
      ),
      "INVALID",
    );
  });

  test("rejects an unknown category", async () => {
    const t = setup();
    const owner = await makeUser(t);
    await expect(
      owner.as.mutation(api.tools.create, tool({ category: "weapons" })),
    ).rejects.toThrow(/Validator/);
  });
});

describe("tools.update", () => {
  test("the owner can edit", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    await owner.as.mutation(api.tools.update, {
      toolId,
      ...tool({ name: "Hammer drill" }),
    });
    const saved = await t.run((ctx) => ctx.db.get("tools", toolId));
    expect(saved?.name).toBe("Hammer drill");
  });

  test("another user and an admin get FORBIDDEN", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const other = await makeUser(t);
    const admin = await makeUser(t, { role: "admin" });
    const toolId = await owner.as.mutation(api.tools.create, tool());
    for (const caller of [other, admin]) {
      await expectCode(
        caller.as.mutation(api.tools.update, { toolId, ...tool() }),
        "FORBIDDEN",
      );
    }
  });
});

describe("tools.remove", () => {
  test("the owner can remove and pending requests become declined", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: TODAY,
      endDate: TODAY,
    });
    await owner.as.mutation(api.tools.remove, { toolId });
    const [savedTool, savedLoan] = await t.run(async (ctx) => [
      await ctx.db.get("tools", toolId),
      await ctx.db.get("loans", loanId),
    ]);
    expect(savedTool).toMatchObject({ removedBy: owner.id });
    expect(savedLoan).toMatchObject({ status: "declined" });
  });

  test("another user gets FORBIDDEN", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const other = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    await expectCode(
      other.as.mutation(api.tools.remove, { toolId }),
      "FORBIDDEN",
    );
  });

  test("the owner cannot remove a tool that is on loan", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    await insertLoan(t, {
      toolId,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: TODAY,
      endDate: TODAY,
      status: "approved",
    });
    await expectCode(
      owner.as.mutation(api.tools.remove, { toolId }),
      "INVALID",
    );
  });

  test("an admin can remove any tool; an open loan stays approved and can still be returned", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const admin = await makeUser(t, { role: "admin" });
    const toolId = await owner.as.mutation(api.tools.create, tool());
    const loanId = await insertLoan(t, {
      toolId,
      borrowerId: borrower.id,
      ownerId: owner.id,
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      status: "approved",
    });
    await admin.as.mutation(api.tools.remove, { toolId });

    const loan = await t.run((ctx) => ctx.db.get("loans", loanId));
    expect(loan?.status).toBe("approved");
    const incoming = await allIncoming(owner.as);
    expect(incoming[0]).toMatchObject({ toolRemoved: true, isOverdue: true });

    await owner.as.mutation(api.loans.markReturned, { loanId });
    expect((await t.run((ctx) => ctx.db.get("loans", loanId)))?.status).toBe(
      "returned",
    );
  });

  test("a removed tool cannot be removed again or requested", async () => {
    const t = setup();
    const owner = await makeUser(t);
    const borrower = await makeUser(t);
    const toolId = await owner.as.mutation(api.tools.create, tool());
    await owner.as.mutation(api.tools.remove, { toolId });
    await expectCode(
      owner.as.mutation(api.tools.remove, { toolId }),
      "NOT_FOUND",
    );
    await expectCode(
      borrower.as.mutation(api.loans.request, {
        toolId,
        startDate: TODAY,
        endDate: TODAY,
      }),
      "NOT_FOUND",
    );
  });
});
