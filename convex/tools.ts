import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/functions";
import { todayUtc } from "./lib/dates";
import {
  isAdmin,
  requireToolOwner,
  requireToolOwnerOrAdmin,
} from "./lib/permissions";
import { requireWithinRateLimit } from "./lib/rateLimits";
import {
  parseOrFail,
  parsePublicToday,
  parseToday,
  toolInput,
} from "./lib/schemas";
import { category, condition } from "./lib/validators";
import {
  activeTools,
  activeToolsOf,
  closeLoansOfRemovedTool,
  listAvailableTools,
  loadActiveTool,
  requireNoApprovedLoan,
  requireRoomForListing,
  toBoardToolView,
  toListingView,
} from "./model/tools";

const toolFields = {
  name: v.string(),
  category,
  condition,
  description: v.string(),
};

export const listPublic = query({
  args: { today: v.string() },
  returns: v.object({
    tools: v.array(
      v.object({ _id: v.id("tools"), name: v.string(), category }),
    ),
    hasMore: v.boolean(),
  }),
  handler: (ctx, { today }) =>
    listAvailableTools(ctx.db, parsePublicToday(today)),
});

export const list = authedQuery({
  args: {
    today: v.string(),
    category: v.optional(category),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const result = await activeTools(ctx.db, args.category)
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map((tool) => toBoardToolView(ctx, tool, ctx.me._id, today)),
    );
    return { ...result, page };
  },
});

export const myListings = authedQuery({
  args: { today: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const result = await activeToolsOf(ctx.db, ctx.me._id)
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map((tool) => toListingView(ctx.db, tool, today)),
    );
    return { ...result, page };
  },
});

export const create = authedMutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const fields = parseOrFail(toolInput, args);
    await requireRoomForListing(ctx.db, ctx.me._id);
    await requireWithinRateLimit(ctx, "createTool", ctx.me._id);
    return ctx.db.insert("tools", { ownerId: ctx.me._id, ...fields });
  },
});

export const update = authedMutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...args }) => {
    const tool = await loadActiveTool(ctx.db, toolId);
    requireToolOwner(tool, ctx.me, "You can only edit your own tools.");
    await ctx.db.patch("tools", toolId, parseOrFail(toolInput, args));
  },
});

export const remove = authedMutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const tool = await loadActiveTool(ctx.db, toolId);
    requireToolOwnerOrAdmin(
      tool,
      ctx.me,
      "You can only remove your own tools.",
    );
    if (!isAdmin(ctx.me)) await requireNoApprovedLoan(ctx.db, toolId);
    await ctx.db.patch("tools", toolId, {
      removedAt: Date.now(),
      removedBy: ctx.me._id,
    });
    await closeLoansOfRemovedTool(ctx, toolId, todayUtc());
  },
});
