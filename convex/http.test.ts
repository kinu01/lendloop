import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { signedHeaders } from "./lib/hmac";
import {
  insertLoan,
  makeUser,
  NOW,
  setup,
  tool,
  TODAY,
  type T,
} from "./test.helpers";

const SECRET = "n8n-to-convex-test-secret";
const nowSeconds = () => Math.floor(NOW.getTime() / 1000);

beforeEach(() => vi.stubEnv("N8N_TO_CONVEX_SECRET", SECRET));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function call(
  t: T,
  method: "GET" | "POST",
  path: string,
  body = "",
  opts: { secret?: string; signPath?: string; seconds?: number } = {},
) {
  const headers = await signedHeaders(
    opts.secret ?? SECRET,
    method,
    opts.signPath ?? path,
    body,
    opts.seconds ?? nowSeconds(),
  );
  return t.fetch(path, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: method === "POST" ? body : undefined,
  });
}

async function overdueScene(t: T) {
  const owner = await makeUser(t);
  const borrower = await makeUser(t, { name: "Linus Torvalds" });
  const toolId = await owner.as.mutation(api.tools.create, tool());
  const loanId = await insertLoan(t, {
    toolId,
    borrowerId: borrower.id,
    ownerId: owner.id,
    startDate: "2026-06-10",
    endDate: "2026-06-14",
    status: "approved",
  });
  return { owner, borrower, toolId, loanId };
}

describe("signature checks", () => {
  test.each([
    ["GET", "/n8n/overdue-loans"],
    ["POST", "/n8n/reminders"],
    ["POST", "/n8n/automation-failures"],
  ] as const)("%s %s rejects a missing signature", async (method, path) => {
    const t = setup();
    const response = await t.fetch(path, {
      method,
      body: method === "POST" ? "{}" : undefined,
    });
    expect(response.status).toBe(401);
  });

  test("rejects a signature made with the wrong secret", async () => {
    const t = setup();
    const response = await call(t, "GET", "/n8n/overdue-loans", "", {
      secret: "wrong",
    });
    expect(response.status).toBe(401);
  });

  test("rejects an expired timestamp", async () => {
    const t = setup();
    const response = await call(t, "GET", "/n8n/overdue-loans", "", {
      seconds: nowSeconds() - 301,
    });
    expect(response.status).toBe(401);
  });

  test("rejects a signature made for a different path", async () => {
    const t = setup();
    const response = await call(t, "POST", "/n8n/reminders", "{}", {
      signPath: "/n8n/automation-failures",
    });
    expect(response.status).toBe(401);
  });

  test("fails closed when the secret is not configured", async () => {
    const t = setup();
    vi.stubEnv("N8N_TO_CONVEX_SECRET", "");
    const response = await call(t, "GET", "/n8n/overdue-loans");
    expect(response.status).toBe(500);
  });
});

describe("logging", () => {
  test("a rejected signature logs the reason and the path, and nothing from the body", async () => {
    const t = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await call(t, "POST", "/n8n/reminders", '{"loanId":"person@example.com"}', {
      secret: "wrong",
    });
    const logged = warn.mock.calls.flat().join(" ");
    warn.mockRestore();
    expect(logged).toContain('"log":"signature_rejected"');
    expect(logged).toContain('"reason":"mismatch"');
    expect(logged).not.toContain("@");
  });
});

describe("GET /n8n/overdue-loans", () => {
  test("says when the feed was cut off at its limit", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await overdueScene(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 500; i += 1) {
        await ctx.db.insert("loans", {
          toolId,
          borrowerId: borrower.id,
          ownerId: owner.id,
          startDate: "2026-06-10",
          endDate: "2026-06-14",
          status: "approved",
        });
      }
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await call(t, "GET", "/n8n/overdue-loans");
    warn.mockRestore();
    const body = (await response.json()) as {
      loans: unknown[];
      truncated: boolean;
    };
    expect(body.truncated).toBe(true);
    expect(body.loans).toHaveLength(500);
  });

  test("returns only overdue loans with only the listed fields", async () => {
    const t = setup();
    const { owner, borrower, toolId, loanId } = await overdueScene(t);
    for (const [endDate, status] of [
      [TODAY, "approved"],
      ["2026-06-01", "returned"],
      ["2026-06-01", "pending"],
    ] as const) {
      await insertLoan(t, {
        toolId,
        borrowerId: borrower.id,
        ownerId: owner.id,
        startDate: "2026-05-30",
        endDate,
        status,
      });
    }
    const response = await call(t, "GET", "/n8n/overdue-loans");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      date: TODAY,
      truncated: false,
      loans: [
        {
          loanId,
          borrowerEmail: borrower.email,
          borrowerFirstName: "Linus",
          toolName: "Cordless drill",
          endDate: "2026-06-14",
        },
      ],
    });
  });

  test("leaves out loans already reminded today", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    await call(
      t,
      "POST",
      "/n8n/reminders",
      JSON.stringify({
        loanId,
        reminderDate: TODAY,
        status: "sent",
        runId: "r1",
      }),
    );
    const response = await call(t, "GET", "/n8n/overdue-loans");
    expect((await response.json()).loans).toEqual([]);
  });

  test("still lists a loan whose tool an admin removed", async () => {
    const t = setup();
    const { toolId, loanId } = await overdueScene(t);
    const admin = await makeUser(t, { role: "admin" });
    await admin.as.mutation(api.tools.remove, { toolId });
    const response = await call(t, "GET", "/n8n/overdue-loans");
    expect(
      (await response.json()).loans.map((l: { loanId: string }) => l.loanId),
    ).toEqual([loanId]);
  });
});

describe("POST /n8n/reminders", () => {
  test("is idempotent: the same body twice creates one record", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    const body = JSON.stringify({
      loanId,
      reminderDate: TODAY,
      status: "sent",
      runId: "run-1",
    });
    const first = await call(t, "POST", "/n8n/reminders", body);
    const second = await call(t, "POST", "/n8n/reminders", body);
    expect(await first.json()).toEqual({ ok: true, duplicate: false });
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    const [reminders, events] = await t.run(async (ctx) => [
      await ctx.db.query("reminders").collect(),
      await ctx.db.query("automationEvents").collect(),
    ]);
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ loanId, reminderDate: TODAY });
    expect(events).toHaveLength(1);
  });

  test("a failed record can be upgraded to sent, but sent is never downgraded", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    const post = (status: string) =>
      call(
        t,
        "POST",
        "/n8n/reminders",
        JSON.stringify({ loanId, reminderDate: TODAY, status, runId: "r" }),
      ).then((r) => r.json());
    expect(await post("failed")).toEqual({ ok: true, duplicate: false });
    expect(await post("sent")).toEqual({ ok: true, duplicate: false });
    expect(await post("failed")).toEqual({ ok: true, duplicate: true });
    const reminders = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(reminders.map((r) => r.status)).toEqual(["sent"]);
  });

  test.each([
    ["not JSON", "nope"],
    ["a missing loanId", { reminderDate: TODAY, status: "sent", runId: "r" }],
    [
      "a bad status",
      { loanId: "x", reminderDate: TODAY, status: "done", runId: "r" },
    ],
    [
      "a bad date",
      { loanId: "x", reminderDate: "2026-13-01", status: "sent", runId: "r" },
    ],
    [
      "a date far from today",
      { loanId: "x", reminderDate: "2026-06-01", status: "sent", runId: "r" },
    ],
  ])("returns 400 for %s", async (_, payload) => {
    const t = setup();
    const body =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const response = await call(t, "POST", "/n8n/reminders", body);
    expect(response.status).toBe(400);
  });

  test("returns 404 for an unknown loan", async () => {
    const t = setup();
    const response = await call(
      t,
      "POST",
      "/n8n/reminders",
      JSON.stringify({
        loanId: "not-a-real-id",
        reminderDate: TODAY,
        status: "sent",
        runId: "r",
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /n8n/reminders/claim", () => {
  const claim = (t: T, loanId: string, runId: string) =>
    call(
      t,
      "POST",
      "/n8n/reminders/claim",
      JSON.stringify({ loanId, reminderDate: TODAY, runId }),
    );

  test("rejects a missing signature", async () => {
    const t = setup();
    const response = await t.fetch("/n8n/reminders/claim", {
      method: "POST",
      body: "{}",
    });
    expect(response.status).toBe(401);
  });

  test("only the first of two runs gets the claim", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    const results = await Promise.all([
      claim(t, loanId, "a"),
      claim(t, loanId, "b"),
    ]);
    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(bodies.filter((b) => b.claimed)).toHaveLength(1);
  });

  test("a claimed loan leaves the feed, so a crash cannot double-send", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    await claim(t, loanId, "a");
    const feed = await call(t, "GET", "/n8n/overdue-loans");
    expect((await feed.json()).loans).toEqual([]);
  });

  test("a retry of the same run keeps the claim it already holds", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    await claim(t, loanId, "a");
    expect(await (await claim(t, loanId, "a")).json()).toEqual({
      claimed: true,
    });
    expect(await (await claim(t, loanId, "b")).json()).toEqual({
      claimed: false,
    });
    const rows = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(rows).toHaveLength(1);
  });

  test("a failed send can be claimed and sent again", async () => {
    const t = setup();
    const { loanId } = await overdueScene(t);
    await claim(t, loanId, "a");
    const post = (status: string, runId: string) =>
      call(
        t,
        "POST",
        "/n8n/reminders",
        JSON.stringify({ loanId, reminderDate: TODAY, status, runId }),
      );
    await post("failed", "a");
    const feed = await call(t, "GET", "/n8n/overdue-loans");
    expect((await feed.json()).loans).toHaveLength(1);
    expect(await (await claim(t, loanId, "b")).json()).toEqual({
      claimed: true,
    });
    await post("sent", "b");
    const rows = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(rows.map((r) => r.status)).toEqual(["sent"]);
  });

  test("returns 400 for a bad body and 404 for an unknown loan", async () => {
    const t = setup();
    expect((await call(t, "POST", "/n8n/reminders/claim", "{}")).status).toBe(
      400,
    );
    expect((await claim(t, "not-a-real-id", "a")).status).toBe(404);
  });
});

describe("POST /n8n/automation-failures", () => {
  test("stores a failure event on the loan and cuts a long message", async () => {
    const t = setup();
    const { loanId, borrower } = await overdueScene(t);
    const response = await call(
      t,
      "POST",
      "/n8n/automation-failures",
      JSON.stringify({
        workflow: "Overdue reminders",
        executionId: "42",
        loanId,
        message: "x".repeat(1000),
      }),
    );
    expect(response.status).toBe(200);
    const events = await borrower.as.query(api.loans.activity, { loanId });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "failure", status: "failed" });
    expect(events[0]).not.toHaveProperty("message");
    const [stored] = await t.run((ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(stored).toMatchObject({ kind: "failure" });
    expect(stored!.kind === "failure" && stored!.message.length).toBe(200);
  });

  test("a replayed failure report is stored once", async () => {
    const t = setup();
    const body = JSON.stringify({
      workflow: "Overdue reminders",
      executionId: "44",
      message: "timeout",
    });
    await call(t, "POST", "/n8n/automation-failures", body);
    await call(t, "POST", "/n8n/automation-failures", body);
    const events = await t.run((ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(events).toHaveLength(1);
  });

  test("stores a failure without a loan", async () => {
    const t = setup();
    const response = await call(
      t,
      "POST",
      "/n8n/automation-failures",
      JSON.stringify({
        workflow: "Overdue reminders",
        executionId: "43",
        message: "timeout",
      }),
    );
    expect(response.status).toBe(200);
    const events = await t.run((ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(events[0]!.loanId).toBeUndefined();
  });

  test("returns 400 for a missing workflow name", async () => {
    const t = setup();
    const response = await call(
      t,
      "POST",
      "/n8n/automation-failures",
      JSON.stringify({ executionId: "1", message: "x" }),
    );
    expect(response.status).toBe(400);
  });
});
