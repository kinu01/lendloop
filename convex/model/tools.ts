import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { fail } from "../lib/errors";
import { firstName } from "../lib/names";
import { PUBLIC_LIST_SIZE } from "../lib/validators";
import { closeLoan, findPendingRequest } from "./loans";

export const MAX_LISTINGS_PER_USER = 50;
// Stops one anonymous query from walking the whole table if most tools are out.
const PUBLIC_SCAN_LIMIT = 500;

export async function loadActiveTool(db: DatabaseReader, toolId: Id<"tools">) {
  const tool = await db.get("tools", toolId);
  if (!tool || tool.removedAt !== undefined)
    fail("NOT_FOUND", "Tool not found.");
  return tool;
}

export function activeTools(
  db: DatabaseReader,
  category?: Doc<"tools">["category"],
) {
  return category
    ? db
        .query("tools")
        .withIndex("by_category_removed", (q) =>
          q.eq("category", category).eq("removedAt", undefined),
        )
    : db
        .query("tools")
        .withIndex("by_removed", (q) => q.eq("removedAt", undefined));
}

export function activeToolsOf(db: DatabaseReader, ownerId: Id<"users">) {
  return db
    .query("tools")
    .withIndex("by_owner_removed", (q) =>
      q.eq("ownerId", ownerId).eq("removedAt", undefined),
    );
}

export async function requireRoomForListing(
  db: DatabaseReader,
  ownerId: Id<"users">,
) {
  const owned = await activeToolsOf(db, ownerId).take(MAX_LISTINGS_PER_USER);
  if (owned.length >= MAX_LISTINGS_PER_USER)
    fail(
      "INVALID",
      `You can list up to ${MAX_LISTINGS_PER_USER} tools. Remove one to add another.`,
    );
}

export async function loanState(
  db: DatabaseReader,
  toolId: Id<"tools">,
  today: string,
) {
  const approved = await db
    .query("loans")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .collect();
  const bookings = approved
    .filter((loan) => loan.endDate >= today)
    .map(({ startDate, endDate }) => ({ startDate, endDate }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const upcoming = bookings.find((loan) => loan.startDate > today);
  const current = approved.find((loan) => loan.startDate <= today);
  return {
    dueBack: current?.endDate ?? null,
    bookings,
    availability: current ? ("on_loan" as const) : ("available" as const),
    nextBooking: upcoming ?? null,
  };
}

export async function listAvailableTools(db: DatabaseReader, today: string) {
  const tools: {
    _id: Id<"tools">;
    name: string;
    category: Doc<"tools">["category"];
  }[] = [];
  let scanned = 0;
  for await (const tool of activeTools(db).order("desc")) {
    // Reaching the scan limit means the rest is unknown, so it counts as more.
    if (scanned === PUBLIC_SCAN_LIMIT) return { tools, hasMore: true };
    scanned += 1;
    const { availability } = await loanState(db, tool._id, today);
    if (availability !== "available") continue;
    // One extra available tool proves there is more, without counting them all.
    if (tools.length === PUBLIC_LIST_SIZE) return { tools, hasMore: true };
    tools.push({ _id: tool._id, name: tool.name, category: tool.category });
  }
  return { tools, hasMore: false };
}

export async function toBoardToolView(
  ctx: QueryCtx,
  tool: Doc<"tools">,
  viewerId: Id<"users">,
  today: string,
) {
  const [owner, mine, state] = await Promise.all([
    ctx.db.get("users", tool.ownerId),
    findPendingRequest(ctx.db, tool._id, viewerId),
    loanState(ctx.db, tool._id, today),
  ]);
  return {
    myPendingRequest: mine
      ? { startDate: mine.startDate, endDate: mine.endDate }
      : null,
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
    ...state,
    ownerFirstName: owner ? firstName(owner.name) : "",
    ownerIsTrustedLender: owner?.isTrustedLender ?? false,
    isMine: tool.ownerId === viewerId,
  };
}

export async function toListingView(
  db: DatabaseReader,
  tool: Doc<"tools">,
  today: string,
) {
  return {
    _id: tool._id,
    _creationTime: tool._creationTime,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
    ...(await loanState(db, tool._id, today)),
  };
}

export async function toAdminToolView(
  ctx: QueryCtx,
  tool: Doc<"tools">,
  today: string,
) {
  const [owner, state] = await Promise.all([
    ctx.db.get("users", tool.ownerId),
    loanState(ctx.db, tool._id, today),
  ]);
  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    ownerFirstName: owner ? firstName(owner.name) : "",
    availability: state.availability,
    bookings: state.bookings,
  };
}

export async function requireNoApprovedLoan(
  db: DatabaseReader,
  toolId: Id<"tools">,
) {
  const open = await db
    .query("loans")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .first();
  if (open)
    fail(
      "INVALID",
      "This tool is on loan. Mark it returned before removing it.",
    );
}

// A loan already under way stays open: the tool is physically out and must come back.
export async function closeLoansOfRemovedTool(
  ctx: MutationCtx,
  toolId: Id<"tools">,
  today: string,
) {
  const withStatus = (status: "pending" | "approved") =>
    ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) =>
        q.eq("toolId", toolId).eq("status", status),
      )
      .collect();
  const [pending, approved] = await Promise.all([
    withStatus("pending"),
    withStatus("approved"),
  ]);
  const notStarted = approved.filter((loan) => loan.startDate > today);
  for (const loan of [...pending, ...notStarted]) {
    await closeLoan(ctx, loan._id, "declined");
  }
}
