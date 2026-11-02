import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { logWarning } from "./lib/log";
import { deliveryStatus } from "./lib/validators";
import { findReminder, listDueReminders } from "./model/reminders";

export const listOverdue = internalQuery({
  args: { date: v.string() },
  returns: v.object({
    loans: v.array(
      v.object({
        loanId: v.id("loans"),
        borrowerEmail: v.string(),
        borrowerFirstName: v.string(),
        toolName: v.string(),
        endDate: v.string(),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: (ctx, { date }) => listDueReminders(ctx.db, date),
});

export const claim = internalMutation({
  args: { loanId: v.string(), reminderDate: v.string(), runId: v.string() },
  handler: async (ctx, { reminderDate, runId, ...args }) => {
    const loanId = ctx.db.normalizeId("loans", args.loanId);
    const loan = loanId ? await ctx.db.get("loans", loanId) : null;
    if (!loan) return { result: "not_found" as const };

    const existing = await findReminder(ctx.db, loan._id, reminderDate);
    // n8n retries a failed step for every loan, including those this run already claimed.
    if (existing?.status === "sending" && existing.runId === runId) {
      return { result: "claimed" as const };
    }
    if (existing && existing.status !== "failed") {
      logWarning("reminder_claim_conflict", {
        loanId: loan._id,
        reminderDate,
        runId,
      });
      return { result: "taken" as const };
    }
    if (existing) {
      await ctx.db.patch("reminders", existing._id, {
        status: "sending",
        runId,
      });
    } else {
      await ctx.db.insert("reminders", {
        loanId: loan._id,
        reminderDate,
        status: "sending",
        runId,
      });
    }
    return { result: "claimed" as const };
  },
});

export const record = internalMutation({
  args: {
    loanId: v.string(),
    reminderDate: v.string(),
    status: deliveryStatus,
    runId: v.string(),
  },
  handler: async (ctx, { reminderDate, status, runId, ...args }) => {
    const loanId = ctx.db.normalizeId("loans", args.loanId);
    const loan = loanId ? await ctx.db.get("loans", loanId) : null;
    if (!loan) return { result: "not_found" as const };

    const existing = await findReminder(ctx.db, loan._id, reminderDate);
    if (
      existing &&
      (existing.status === "sent" || existing.status === status)
    ) {
      return { result: "duplicate" as const };
    }
    if (existing) {
      await ctx.db.patch("reminders", existing._id, { status, runId });
    } else {
      await ctx.db.insert("reminders", {
        loanId: loan._id,
        reminderDate,
        status,
        runId,
      });
    }
    await ctx.db.insert("automationEvents", {
      kind: "reminder",
      loanId: loan._id,
      status,
      ...(status === "failed" ? { needsAdmin: true as const } : {}),
    });
    return { result: "recorded" as const };
  },
});
