import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { todayUtc } from "./lib/dates";
import { fail } from "./lib/errors";
import { authedMutation, authedQuery } from "./lib/functions";
import {
  requireLoanBorrower,
  requireLoanOwner,
  requireLoanPartyOrAdmin,
  requireNotToolOwner,
} from "./lib/permissions";
import { requireWithinRateLimit } from "./lib/rateLimits";
import { loanDates, parseOrFail, parseToday } from "./lib/schemas";
import { WAITING_COUNT_LIMIT } from "./lib/validators";
import {
  closeLoan,
  findPendingRequest,
  hasApprovedOverlap,
  isTooLateToStart,
  loadLoan,
  requireCanCallOff,
  requireStatus,
  toActivityView,
  toLoanViews,
} from "./model/loans";
import { scheduleNotification } from "./model/notifications";
import { loadActiveTool } from "./model/tools";

export const MAX_OPEN_REQUESTS = 20;
const ACTIVITY_LIMIT = 5;

export const request = authedMutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, ...dates }) => {
    const tool = await loadActiveTool(ctx.db, toolId);
    requireNotToolOwner(tool, ctx.me);
    const { startDate, endDate } = parseOrFail(loanDates, dates);
    if (isTooLateToStart(startDate, todayUtc()))
      fail("INVALID", "The start date cannot be in the past.");
    if (await hasApprovedOverlap(ctx.db, { toolId, startDate, endDate }))
      fail("INVALID", "The tool is already lent out for some of those dates.");
    if (await findPendingRequest(ctx.db, toolId, ctx.me._id))
      fail("INVALID", "You already have a pending request for this tool.");

    const open = await ctx.db
      .query("loans")
      .withIndex("by_borrower_status", (q) =>
        q.eq("borrowerId", ctx.me._id).eq("status", "pending"),
      )
      .take(MAX_OPEN_REQUESTS);
    if (open.length >= MAX_OPEN_REQUESTS)
      fail(
        "INVALID",
        `You can have up to ${MAX_OPEN_REQUESTS} open requests. Cancel one to ask for another.`,
      );
    await requireWithinRateLimit(ctx, "requestLoan", ctx.me._id);

    const loanId = await ctx.db.insert("loans", {
      toolId,
      borrowerId: ctx.me._id,
      ownerId: tool.ownerId,
      startDate,
      endDate,
      status: "pending",
    });
    await scheduleNotification(ctx, loanId, "created");
    return loanId;
  },
});

export const cancel = authedMutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await loadLoan(ctx.db, loanId);
    requireLoanBorrower(loan, ctx.me, "You can only cancel your own requests.");
    requireCanCallOff(loan, todayUtc());
    await closeLoan(ctx, loanId, "cancelled");
  },
});

export const approve = authedMutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await loadLoan(ctx.db, loanId);
    requireLoanOwner(
      loan,
      ctx.me,
      "You can only approve requests for your own tools.",
    );
    requireStatus(loan, "pending");
    if (isTooLateToStart(loan.startDate, todayUtc()))
      fail("INVALID", "This request has expired. Its start date has passed.");
    if (await hasApprovedOverlap(ctx.db, loan))
      fail("INVALID", "Another approved loan overlaps these dates.");
    await ctx.db.patch("loans", loanId, { status: "approved" });
    await scheduleNotification(ctx, loanId, "approved");
  },
});

export const decline = authedMutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await loadLoan(ctx.db, loanId);
    requireLoanOwner(
      loan,
      ctx.me,
      "You can only decline requests for your own tools.",
    );
    requireCanCallOff(loan, todayUtc());
    await closeLoan(ctx, loanId, "declined");
  },
});

export const markReturned = authedMutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await loadLoan(ctx.db, loanId);
    requireLoanOwner(
      loan,
      ctx.me,
      "Only the owner can mark a loan as returned.",
    );
    requireStatus(loan, "approved");
    if (loan.startDate > todayUtc())
      fail("INVALID", "This loan has not started yet. Call it off instead.");
    await closeLoan(ctx, loanId, "returned");
  },
});

export const myRequests = authedQuery({
  args: { today: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const result = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", ctx.me._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await toLoanViews(ctx, result.page, "borrower", today),
    };
  },
});

export const incoming = authedQuery({
  args: {
    today: v.string(),
    group: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("past"),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { group, paginationOpts, ...args }) => {
    const today = parseToday(args.today);
    const loans =
      group === "past"
        ? ctx.db
            .query("loans")
            .withIndex("by_owner_closed", (q) =>
              q.eq("ownerId", ctx.me._id).gt("closedAt", 0),
            )
            .order("desc")
        : ctx.db
            .query("loans")
            .withIndex("by_owner_status", (q) =>
              q.eq("ownerId", ctx.me._id).eq("status", group),
            );
    const result = await loans.paginate(paginationOpts);
    return {
      ...result,
      page: await toLoanViews(ctx, result.page, "owner", today),
    };
  },
});

export const waitingCount = authedQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("loans")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", ctx.me._id).eq("status", "pending"),
      )
      .take(WAITING_COUNT_LIMIT + 1);
    return pending.length;
  },
});

export const activity = authedQuery({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await loadLoan(ctx.db, loanId);
    requireLoanPartyOrAdmin(loan, ctx.me);
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .order("desc")
      .take(ACTIVITY_LIMIT);
    return events.map(toActivityView);
  },
});
