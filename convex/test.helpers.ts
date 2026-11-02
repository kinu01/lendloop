import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { expect, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

export const NOW = new Date("2026-06-15T10:00:00Z");
export const TODAY = "2026-06-15";

export function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

export type T = ReturnType<typeof setup>;

let counter = 0;

export async function makeUser(
  t: T,
  opts: { name?: string; role?: "user" | "admin"; trusted?: boolean } = {},
) {
  counter += 1;
  const name = opts.name ?? `User ${counter}`;
  const email = `user${counter}@example.com`;
  const tokenIdentifier = `https://clerk.test|user_${counter}`;
  const id = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier,
      email,
      name,
      role: opts.role ?? "user",
      isTrustedLender: opts.trusted ?? false,
    }),
  );
  const as = t.withIdentity({
    tokenIdentifier,
    subject: `user_${counter}`,
    issuer: "https://clerk.test",
    name,
    email,
  });
  return { id, email, as };
}

export function tool(overrides: Record<string, unknown> = {}) {
  return {
    name: "Cordless drill",
    category: "power tools" as const,
    condition: "good" as const,
    description: "18V with two batteries.",
    ...overrides,
  };
}

export async function insertLoan(
  t: T,
  loan: {
    toolId: Id<"tools">;
    borrowerId: Id<"users">;
    ownerId: Id<"users">;
    startDate: string;
    endDate: string;
    status: "pending" | "approved" | "declined" | "cancelled" | "returned";
  },
) {
  const closed = ["declined", "cancelled", "returned"].includes(loan.status);
  return t.run((ctx) =>
    ctx.db.insert("loans", {
      ...loan,
      ...(closed ? { closedAt: NOW.getTime() } : {}),
    }),
  );
}

export async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).not.toBeNull();
  expect((error as { data?: { code?: string } }).data?.code).toBe(code);
}

export const PAGE_ONLY = { paginationOpts: { numItems: 200, cursor: null } };
export const PAGE = { today: TODAY, ...PAGE_ONLY };

export async function insertTool(t: T, ownerId: Id<"users">, name = "Tool") {
  return t.run((ctx) =>
    ctx.db.insert("tools", {
      ownerId,
      name,
      category: "other",
      condition: "good",
      description: "",
    }),
  );
}

type Caller = Pick<T, "query">;

export async function allIncoming(as: Caller) {
  const lists = await Promise.all(
    (["pending", "approved", "past"] as const).map((group) =>
      as.query(api.loans.incoming, { group, ...PAGE }),
    ),
  );
  return lists.flatMap((list) => list.page);
}
