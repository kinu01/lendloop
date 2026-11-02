import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { notificationFacts } from "./lib/validators";

export const recordNotification = internalMutation({
  args: notificationFacts,
  handler: async (ctx, args) => {
    await ctx.db.insert("automationEvents", {
      kind: "notification",
      ...args,
      ...(args.status === "failed" && !args.willRetry
        ? { needsAdmin: true as const }
        : {}),
    });
  },
});

export const recordFailure = internalMutation({
  args: {
    workflow: v.string(),
    executionId: v.string(),
    loanId: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, { workflow, executionId, message, ...args }) => {
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_failure_run", (q) =>
        q.eq("workflow", workflow).eq("executionId", executionId),
      )
      .first();
    if (existing) return;
    const loanId = args.loanId
      ? ctx.db.normalizeId("loans", args.loanId)
      : null;
    const loan = loanId ? await ctx.db.get("loans", loanId) : null;
    await ctx.db.insert("automationEvents", {
      kind: "failure",
      needsAdmin: true,
      loanId: loan?._id,
      workflow,
      executionId,
      message,
    });
  },
});
