import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { addDays, todayUtc } from "./lib/dates";
import { fail } from "./lib/errors";
import { resetRateLimits } from "./lib/rateLimits";

const PAGING_TOOLS = 30;

function requireSeedAllowed() {
  if (env.ALLOW_DEMO_SEED !== "true")
    fail(
      "FORBIDDEN",
      "Demo data is off. Set ALLOW_DEMO_SEED=true to allow it.",
    );
}

async function demoUser(ctx: MutationCtx, key: string, name: string) {
  const tokenIdentifier = `demo|${key}`;
  const existing = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
  if (existing) return existing._id;
  return ctx.db.insert("users", {
    tokenIdentifier,
    email: `${key}@demo.lendloop.test`,
    name,
    role: "user",
    isTrustedLender: key === "amaka",
  });
}

export const demo = internalMutation({
  args: { forEmail: v.optional(v.string()) },
  handler: async (ctx, { forEmail }) => {
    requireSeedAllowed();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", "demo|amaka"))
      .unique();
    if (existing) return "Demo data already exists.";

    const amaka = await demoUser(ctx, "amaka", "Amaka Obi");
    const tunde = await demoUser(ctx, "tunde", "Tunde Bello");
    const tools: [
      Id<"users">,
      string,
      "power tools" | "garden" | "camping" | "kitchen",
      string,
    ][] = [
      [
        amaka,
        "Cordless drill",
        "power tools",
        "18V with two batteries and a bit set.",
      ],
      [amaka, "Hedge trimmer", "garden", "Electric, 50 cm blade."],
      [tunde, "Two-person tent", "camping", "Waterproof, packs small."],
      [tunde, "Stand mixer", "kitchen", "5 litre bowl with dough hook."],
    ];
    for (const [ownerId, name, category, description] of tools) {
      await ctx.db.insert("tools", {
        ownerId,
        name,
        category,
        condition: "good",
        description,
      });
    }

    if (forEmail) {
      const me = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", forEmail))
        .first();
      if (!me)
        fail("NOT_FOUND", `No user with email ${forEmail}. Sign in first.`);
      const today = todayUtc();
      const ladder = await ctx.db.insert("tools", {
        ownerId: me._id,
        name: "Ladder",
        category: "power tools",
        condition: "fair",
        description: "3 metre aluminium ladder.",
      });
      await ctx.db.insert("loans", {
        toolId: ladder,
        borrowerId: amaka,
        ownerId: me._id,
        startDate: addDays(today, 3),
        endDate: addDays(today, 5),
        status: "pending",
      });
      const saw = await ctx.db.insert("tools", {
        ownerId: me._id,
        name: "Circular saw",
        category: "power tools",
        condition: "good",
        description: "With a spare blade.",
      });
      await ctx.db.insert("loans", {
        toolId: saw,
        borrowerId: tunde,
        ownerId: me._id,
        startDate: addDays(today, -6),
        endDate: addDays(today, -2),
        status: "approved",
      });
    }
    return "Demo data created.";
  },
});

// The live n8n tests use demo people, so they never touch a real account.
export const overdueLoan = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireSeedAllowed();
    const today = todayUtc();
    const ownerId = await demoUser(ctx, "amaka", "Amaka Obi");
    const toolId = await ctx.db.insert("tools", {
      ownerId,
      name: "Wheelbarrow",
      category: "garden",
      condition: "good",
      description: "A demo tool with an overdue loan, for trying reminders.",
    });
    return await ctx.db.insert("loans", {
      toolId,
      borrowerId: await demoUser(ctx, "tunde", "Tunde Bello"),
      ownerId,
      startDate: addDays(today, -5),
      endDate: addDays(today, -1),
      status: "approved",
    });
  },
});

export const removeOverdueLoan = internalMutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    requireSeedAllowed();
    const loan = await ctx.db.get("loans", loanId);
    if (!loan) return;
    const [reminders, events] = await Promise.all([
      ctx.db
        .query("reminders")
        .withIndex("by_loan_date", (q) => q.eq("loanId", loanId))
        .collect(),
      ctx.db
        .query("automationEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect(),
    ]);
    await Promise.all([
      ...reminders.map((row) => ctx.db.delete("reminders", row._id)),
      ...events.map((row) => ctx.db.delete("automationEvents", row._id)),
      ctx.db.delete("loans", loanId),
      ctx.db.delete("tools", loan.toolId),
    ]);
  },
});

// The browser tests list more tools per run than a person would in an hour.
export const resetRateLimitsFor = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    requireSeedAllowed();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) fail("NOT_FOUND", `No user with email ${email}. Sign in first.`);
    await resetRateLimits(ctx, user._id);
  },
});

const PAGING_PREFIX = "Paging test tool";

// Gives the browser test more rows than one page, and removeToolsForPaging clears them after.
export const toolsForPaging = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireSeedAllowed();
    const ownerId = await demoUser(ctx, "amaka", "Amaka Obi");
    for (let i = 0; i < PAGING_TOOLS; i += 1) {
      await ctx.db.insert("tools", {
        ownerId,
        name: `${PAGING_PREFIX} ${i}`,
        category: "other",
        condition: "good",
        description: "",
      });
    }
  },
});

export const removeToolsForPaging = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireSeedAllowed();
    const tools = await ctx.db.query("tools").collect();
    for (const tool of tools) {
      if (tool.name.startsWith(PAGING_PREFIX)) {
        await ctx.db.delete("tools", tool._id);
      }
    }
  },
});
