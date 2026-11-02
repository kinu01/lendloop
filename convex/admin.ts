import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { fail } from "./lib/errors";
import { adminMutation, adminQuery } from "./lib/functions";
import { parseToday } from "./lib/schemas";
import { describeFailure } from "./model/automation";
import { toLoanViews } from "./model/loans";
import { activeTools, toAdminToolView } from "./model/tools";
import { toUserView } from "./model/users";

export const listTools = adminQuery({
  args: { today: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const result = await activeTools(ctx.db)
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map((tool) => toAdminToolView(ctx, tool, today)),
    );
    return { ...result, page };
  },
});

export const listAllLoans = adminQuery({
  args: { today: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const result = await ctx.db
      .query("loans")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await toLoanViews(ctx, result.page, "admin", today),
    };
  },
});

export const listUsers = adminQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("users")
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: result.page.map(toUserView) };
  },
});

export const listAutomationFailures = adminQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("automationEvents")
      .withIndex("by_needs_admin", (q) => q.eq("needsAdmin", true))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (event) => {
        const loan = event.loanId
          ? await ctx.db.get("loans", event.loanId)
          : null;
        const tool = loan ? await ctx.db.get("tools", loan.toolId) : null;
        return {
          _id: event._id,
          at: event._creationTime,
          toolName: tool?.name ?? null,
          ...describeFailure(event),
        };
      }),
    );
    return { ...result, page };
  },
});

export const setTrustedLender = adminMutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) fail("NOT_FOUND", "User not found.");
    await ctx.db.patch("users", userId, { isTrustedLender: trusted });
  },
});
