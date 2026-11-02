import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import { firstName } from "../lib/names";

const OVERDUE_LIMIT = 500;

export function findReminder(
  db: DatabaseReader,
  loanId: Id<"loans">,
  reminderDate: string,
) {
  return db
    .query("reminders")
    .withIndex("by_loan_date", (q) =>
      q.eq("loanId", loanId).eq("reminderDate", reminderDate),
    )
    .unique();
}

export async function listDueReminders(db: DatabaseReader, date: string) {
  const overdue = await db
    .query("loans")
    .withIndex("by_status_end", (q) =>
      q.eq("status", "approved").lt("endDate", date),
    )
    .take(OVERDUE_LIMIT + 1);
  const rows = await Promise.all(
    overdue.slice(0, OVERDUE_LIMIT).map(async (loan) => {
      const [existing, borrower, tool] = await Promise.all([
        findReminder(db, loan._id, date),
        db.get("users", loan.borrowerId),
        db.get("tools", loan.toolId),
      ]);
      const taken = existing && existing.status !== "failed";
      if (taken || !borrower || !tool) return null;
      return {
        loanId: loan._id,
        borrowerEmail: borrower.email,
        borrowerFirstName: firstName(borrower.name),
        toolName: tool.name,
        endDate: loan.endDate,
      };
    }),
  );
  return {
    loans: rows.filter((row) => row !== null),
    truncated: overdue.length > OVERDUE_LIMIT,
  };
}
