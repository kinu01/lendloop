import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { expectCode, makeUser, setup, tool } from "./test.helpers";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("seed", () => {
  test("refuses to run unless demo data is switched on", async () => {
    const t = setup();
    vi.stubEnv("ALLOW_DEMO_SEED", "");
    await expectCode(t.mutation(internal.seed.demo, {}), "FORBIDDEN");
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toEqual([]);
  });

  test("creates demo data when switched on", async () => {
    const t = setup();
    vi.stubEnv("ALLOW_DEMO_SEED", "true");
    await t.mutation(internal.seed.demo, {});
    const tools = await t.run((ctx) => ctx.db.query("tools").collect());
    expect(tools.length).toBeGreaterThan(0);
  });

  test("resetting a user's rate limits lets them act again, and is guarded", async () => {
    const t = setup();
    const user = await makeUser(t);
    for (let i = 0; i < 20; i += 1) {
      await user.as.mutation(api.tools.create, tool());
    }
    await expectCode(
      user.as.mutation(api.tools.create, tool()),
      "RATE_LIMITED",
    );
    const args = { email: user.email };
    vi.stubEnv("ALLOW_DEMO_SEED", "");
    await expectCode(
      t.mutation(internal.seed.resetRateLimitsFor, args),
      "FORBIDDEN",
    );
    vi.stubEnv("ALLOW_DEMO_SEED", "true");
    await t.mutation(internal.seed.resetRateLimitsFor, args);
    await user.as.mutation(api.tools.create, tool());
  });

  test("the paging rows can be added and removed, leaving other tools alone", async () => {
    const t = setup();
    vi.stubEnv("ALLOW_DEMO_SEED", "true");
    const user = await makeUser(t);
    await user.as.mutation(api.tools.create, tool({ name: "Real ladder" }));
    await t.mutation(internal.seed.toolsForPaging, {});
    const names = () =>
      t.run(async (ctx) =>
        (await ctx.db.query("tools").collect()).map((row) => row.name),
      );
    expect(await names()).toHaveLength(31);
    await t.mutation(internal.seed.removeToolsForPaging, {});
    expect(await names()).toEqual(["Real ladder"]);
  });
});
