import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { addDays, rangesOverlap } from "../lib/dates";
import { fail } from "../lib/errors";
import { firstName } from "../lib/names";
import { scheduleNotification } from "./notifications";

export type LoanViewer = "borrower" | "owner" | "admin";
type ClosedStatus = "declined" | "cancelled" | "returned";

export async function loadLoan(db: DatabaseReader, loanId: Id<"loans">) {
  const loan = await db.get("loans", loanId);
  if (!loan) fail("NOT_FOUND", "Request not found.");
  return loan;
}

export function requireStatus(
  loan: Doc<"loans">,
  status: Doc<"loans">["status"],
) {
  if (loan.status !== status)
    fail("INVALID", `This request is ${loan.status}, not ${status}.`);
}

export function requireCanCallOff(loan: Doc<"loans">, today: string) {
  const notStarted = loan.status === "approved" && loan.startDate > today;
  if (loan.status !== "pending" && !notStarted)
    fail("INVALID", `This request is ${loan.status} and can no longer change.`);
}

// A borrower's local date can be a day behind UTC.
export function isTooLateToStart(startDate: string, today: string) {
  return startDate < addDays(today, -1);
}

export async function hasApprovedOverlap(
  db: DatabaseReader,
  loan: Pick<Doc<"loans">, "toolId" | "startDate" | "endDate">,
) {
  const approved = await db
    .query("loans")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", loan.toolId).eq("status", "approved"),
    )
    .collect();
  return approved.some((other) => rangesOverlap(other, loan));
}

export async function findPendingRequest(
  db: DatabaseReader,
  toolId: Id<"tools">,
  borrowerId: Id<"users">,
) {
  return db
    .query("loans")
    .withIndex("by_tool_status", (q) =>
      q
        .eq("toolId", toolId)
        .eq("status", "pending")
        .eq("borrowerId", borrowerId),
    )
    .first();
}

export async function closeLoan(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  status: ClosedStatus,
) {
  await ctx.db.patch("loans", loanId, { status, closedAt: Date.now() });
  await scheduleNotification(ctx, loanId, status);
}

export function toActivityView(event: Doc<"automationEvents">) {
  const shared = { _id: event._id, at: event._creationTime };
  switch (event.kind) {
    case "notification":
      return {
        ...shared,
        kind: event.kind,
        event: event.event,
        status: event.status,
        attempt: event.attempt,
        willRetry: event.willRetry,
        problem: event.problem,
        httpStatus: event.httpStatus,
      };
    case "reminder":
      return { ...shared, kind: event.kind, status: event.status };
    case "failure":
      // The run's technical details are for admins, on the admin page only.
      return { ...shared, kind: event.kind, status: "failed" as const };
  }
}

export async function toLoanView(
  ctx: QueryCtx,
  loan: Doc<"loans">,
  viewer: LoanViewer,
  today: string,
) {
  const [tool, borrower, owner, latest] = await Promise.all([
    ctx.db.get("tools", loan.toolId),
    ctx.db.get("users", loan.borrowerId),
    ctx.db.get("users", loan.ownerId),
    ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .order("desc")
      .first(),
  ]);
  // Neighbors need a way to meet, but only once the owner has said yes.
  const other = viewer === "borrower" ? owner : borrower;
  const contactEmail =
    viewer !== "admin" && loan.status === "approved" && other
      ? other.email
      : null;
  return {
    _id: loan._id,
    _creationTime: loan._creationTime,
    toolId: loan.toolId,
    toolName: tool?.name ?? "Removed tool",
    toolRemoved: tool?.removedAt !== undefined,
    borrowerFirstName: borrower ? firstName(borrower.name) : "",
    ownerFirstName: owner ? firstName(owner.name) : "",
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    contactEmail,
    hasStarted: loan.startDate <= today,
    isOverdue: loan.status === "approved" && loan.endDate < today,
    latestActivity: latest ? toActivityView(latest) : null,
  };
}

export function toLoanViews(
  ctx: QueryCtx,
  loans: Doc<"loans">[],
  viewer: LoanViewer,
  today: string,
) {
  return Promise.all(loans.map((loan) => toLoanView(ctx, loan, viewer, today)));
}
