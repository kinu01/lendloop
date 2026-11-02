import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { expectCode, makeUser, setup, PAGE_ONLY, TODAY } from "./test.helpers";

afterEach(() => vi.useRealTimers());

describe("users", () => {
  test("store creates a user row with the user role", async () => {
    const t = setup();
    const as = t.withIdentity({
      tokenIdentifier: "https://clerk.test|new",
      name: "Grace Hopper",
      email: "grace@example.com",
    });
    await as.mutation(api.users.store, {});
    expect(await as.query(api.users.me, {})).toMatchObject({
      name: "Grace Hopper",
      email: "grace@example.com",
      role: "user",
      isTrustedLender: false,
    });
  });

  test("store is safe to call twice and never changes the role", async () => {
    const t = setup();
    const admin = await makeUser(t, { role: "admin" });
    const first = await admin.as.mutation(api.users.store, {});
    const second = await admin.as.mutation(api.users.store, {});
    expect(second).toBe(first);
    expect((await admin.as.query(api.users.me, {})).role).toBe("admin");
  });

  test("store rejects an identity with no email", async () => {
    const t = setup();
    const as = t.withIdentity({
      tokenIdentifier: "https://clerk.test|no-email",
      name: "No Email",
    });
    await expectCode(as.mutation(api.users.store, {}), "INVALID");
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  test("store caps a very long name from the token", async () => {
    const t = setup();
    const as = t.withIdentity({
      tokenIdentifier: "https://clerk.test|long",
      email: "long@example.com",
      name: "x".repeat(5000),
    });
    await as.mutation(api.users.store, {});
    expect((await as.query(api.users.me, {})).name).toHaveLength(100);
  });

  test("store never uses the email address when the name claim is empty", async () => {
    const t = setup();
    const as = t.withIdentity({
      tokenIdentifier: "https://clerk.test|no-name",
      email: "jane.doe+bank@example.com",
    });
    await as.mutation(api.users.store, {});
    expect((await as.query(api.users.me, {})).name).toBe("Neighbor");
  });

  test("store fills in email and name that were missing before", async () => {
    const t = setup();
    const tokenIdentifier = "https://clerk.test|backfill";
    await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier,
        email: "",
        name: "",
        role: "user",
        isTrustedLender: false,
      }),
    );
    const as = t.withIdentity({
      tokenIdentifier,
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    await as.mutation(api.users.store, {});
    expect(await as.query(api.users.me, {})).toMatchObject({
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
  });

  test("store and me require sign-in", async () => {
    const t = setup();
    await expectCode(t.mutation(api.users.store, {}), "UNAUTHENTICATED");
    await expectCode(t.query(api.users.me, {}), "UNAUTHENTICATED");
  });

  test("a signed-in caller with no row yet gets UNAUTHENTICATED", async () => {
    const t = setup();
    const as = t.withIdentity({ tokenIdentifier: "https://clerk.test|ghost" });
    await expectCode(as.query(api.users.me, {}), "UNAUTHENTICATED");
    await expectCode(
      as.query(api.tools.list, { today: TODAY, ...PAGE_ONLY }),
      "UNAUTHENTICATED",
    );
  });

  test("setRole (internal) promotes a user by email", async () => {
    const t = setup();
    const user = await makeUser(t);
    await t.mutation(internal.users.setRole, {
      email: user.email,
      role: "admin",
    });
    expect((await user.as.query(api.users.me, {})).role).toBe("admin");
  });

  test("setRole refuses an email shared by two accounts", async () => {
    const t = setup();
    for (const suffix of ["a", "b"]) {
      await t.run((ctx) =>
        ctx.db.insert("users", {
          tokenIdentifier: `https://clerk.test|dup-${suffix}`,
          email: "same@example.com",
          name: "Same",
          role: "user",
          isTrustedLender: false,
        }),
      );
    }
    await expectCode(
      t.mutation(internal.users.setRole, {
        email: "same@example.com",
        role: "admin",
      }),
      "INVALID",
    );
  });

  test("setRole fails for an unknown email", async () => {
    const t = setup();
    await expectCode(
      t.mutation(internal.users.setRole, {
        email: "nobody@example.com",
        role: "admin",
      }),
      "NOT_FOUND",
    );
  });
});
