import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verify } from "./lib/hmac";
import { makeUser, NOW, setup, tool, type T } from "./test.helpers";

const SECRET = "convex-to-n8n-test-secret";
const URL_ = "http://n8n.test/webhook/lendloop-request";

beforeEach(() => {
  vi.stubEnv("N8N_WEBHOOK_URL", URL_);
  vi.stubEnv("CONVEX_TO_N8N_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function scene(t: T) {
  const owner = await makeUser(t, { name: "Olu Owner" });
  const borrower = await makeUser(t, { name: "Bola Borrower" });
  const toolId = await owner.as.mutation(api.tools.create, tool());
  const loanId = await borrower.as.mutation(api.loans.request, {
    toolId,
    startDate: "2026-06-16",
    endDate: "2026-06-17",
  });
  return { owner, borrower, loanId };
}

function approve(t: T, loanId: Id<"loans">) {
  return t.run((ctx) => ctx.db.patch("loans", loanId, { status: "approved" }));
}

function send(t: T, loanId: string, event: string, attempt = 1) {
  return t.action(internal.notify.sendRequestEvent, {
    loanId: loanId as never,
    event: event as never,
    changedAt: NOW.getTime(),
    attempt,
  });
}

describe("notify.sendRequestEvent", () => {
  test.each([
    ["approved", "declined"],
    ["created", "cancelled"],
  ])(
    "a late %s message is skipped once the loan is %s",
    async (event, status) => {
      const t = setup();
      const { loanId } = await scene(t);
      await t.run((ctx) =>
        ctx.db.patch("loans", loanId, { status: status as never }),
      );
      const fetchMock = vi.fn(async () => new Response("ok"));
      vi.stubGlobal("fetch", fetchMock);
      await send(t, loanId, event, 2);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("a closing message is still sent after the loan has closed", async () => {
    const t = setup();
    const { loanId } = await scene(t);
    await t.run((ctx) => ctx.db.patch("loans", loanId, { status: "declined" }));
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await send(t, loanId, "declined");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("posts a signed payload with only the needed fields", async () => {
    const t = setup();
    const { owner, loanId } = await scene(t);
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await send(t, loanId, "created");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(URL_);
    expect(init.redirect).toBe("error");
    const headers = init.headers as Record<string, string>;
    const body = init.body as string;
    expect(
      await verify({
        secret: SECRET,
        timestamp: headers["X-LendLoop-Timestamp"]!,
        signature: headers["X-LendLoop-Signature"]!,
        method: "POST",
        path: "/webhook/lendloop-request",
        body,
        nowSeconds: Math.floor(NOW.getTime() / 1000),
      }),
    ).toEqual({ ok: true });
    expect(JSON.parse(body)).toEqual({
      eventId: `${loanId}:created:${NOW.getTime()}`,
      event: "created",
      loanId,
      recipient: { firstName: "Olu", email: owner.email },
      toolName: "Cordless drill",
      startDate: "2026-06-16",
      endDate: "2026-06-17",
    });
  });

  test.each([
    ["created", "owner"],
    ["cancelled", "owner"],
    ["approved", "borrower"],
    ["declined", "borrower"],
    ["returned", "borrower"],
  ])("sends %s to the %s", async (event, who) => {
    const t = setup();
    const s = await scene(t);
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    if (event === "approved") await approve(t, s.loanId);
    await send(t, s.loanId, event);
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    const expected = who === "owner" ? s.owner.email : s.borrower.email;
    expect(JSON.parse(init.body as string).recipient.email).toBe(expected);
  });

  test("only an approval shares the owner's contact with the borrower", async () => {
    const t = setup();
    const s = await scene(t);
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await approve(t, s.loanId);
    await send(t, s.loanId, "approved");
    await send(t, s.loanId, "declined");
    const bodies = fetchMock.mock.calls.map((call) => {
      const [, init] = call as unknown as [string, RequestInit];
      return JSON.parse(init.body as string);
    });
    expect(bodies[0].contact).toEqual({
      firstName: "Olu",
      email: s.owner.email,
    });
    expect(bodies[1].contact).toBeUndefined();
  });

  test("records success on the loan", async () => {
    const t = setup();
    const { borrower, loanId } = await scene(t);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok")),
    );
    await send(t, loanId, "created");
    const events = await borrower.as.query(api.loans.activity, { loanId });
    expect(events[0]).toMatchObject({ kind: "notification", status: "sent" });
  });

  test("a failed attempt is recorded and a retry is scheduled", async () => {
    const t = setup();
    const { loanId } = await scene(t);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 })),
    );
    await send(t, loanId, "created");
    const [events, jobs] = await t.run(async (ctx) => [
      await ctx.db.query("automationEvents").collect(),
      await ctx.db.system.query("_scheduled_functions").collect(),
    ]);
    expect(events[0]).toMatchObject({
      status: "failed",
      attempt: 1,
      willRetry: true,
      problem: "http_error",
      httpStatus: 500,
    });
    expect(jobs.at(-1)?.args[0]).toMatchObject({ attempt: 2 });
  });

  test("a failure logs IDs and codes, and never an email", async () => {
    const t = setup();
    const { loanId } = await scene(t);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 })),
    );
    await send(t, loanId, "created");
    const logged = warn.mock.calls.flat().join(" ");
    warn.mockRestore();
    expect(logged).toContain('"log":"notification_failed"');
    expect(logged).toContain(loanId);
    expect(logged).not.toContain("@");
  });

  test("gives up after the last attempt and says so", async () => {
    const t = setup();
    const { loanId } = await scene(t);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await send(t, loanId, "created", 4);
    const [events, jobs] = await t.run(async (ctx) => [
      await ctx.db.query("automationEvents").collect(),
      await ctx.db.system.query("_scheduled_functions").collect(),
    ]);
    expect(events[0]).toMatchObject({
      attempt: 4,
      willRetry: false,
      problem: "unreachable",
    });
    expect(jobs.filter((j) => j.args[0].attempt === 5)).toHaveLength(0);
  });

  test("records a failure and does not call out when not configured", async () => {
    const t = setup();
    const { loanId } = await scene(t);
    vi.stubEnv("N8N_WEBHOOK_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await send(t, loanId, "created");
    expect(fetchMock).not.toHaveBeenCalled();
    const events = await t.run((ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(events[0]).toMatchObject({ problem: "not_configured" });
  });
});
