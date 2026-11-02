import { expect, test } from "@playwright/test";
import {
  maskEmail,
  n8nLogLines,
  overdueFeed,
  remindersFor,
  runReminderWorkflow,
  seedOverdueLoan,
  requireStack,
  tableRows,
  type AutomationEvent,
} from "./helpers";

requireStack();

test("an overdue loan gets exactly one reminder, across two runs", async ({
  request,
}) => {
  const loan = await seedOverdueLoan();
  const feedBefore = await overdueFeed(request);
  const row = feedBefore.loans.find((entry) => entry.loanId === loan._id);
  if (!row) throw new Error("The seeded loan is not in the overdue feed.");
  expect(Object.keys(row).sort()).toEqual([
    "borrowerEmail",
    "borrowerFirstName",
    "endDate",
    "loanId",
    "toolName",
  ]);
  expect(await remindersFor(loan._id)).toEqual([]);

  const sendLines = (lines: string[]) =>
    lines.filter((line) => line.includes(`[mock reminder] loan=${loan._id} `));

  const firstRun = sendLines(await runReminderWorkflow());
  expect(firstRun).toHaveLength(1);
  expect(firstRun[0]).toContain(`to=${maskEmail(row.borrowerEmail)} `);
  expect(firstRun[0]!.includes(row.borrowerEmail)).toBe(false);

  const afterFirst = await remindersFor(loan._id);
  expect(afterFirst).toHaveLength(1);
  expect(afterFirst[0]!.status).toBe("sent");

  const feedAfter = await overdueFeed(request);
  expect(feedAfter.loans.map((entry) => entry.loanId)).not.toContain(loan._id);

  const secondRun = sendLines(await runReminderWorkflow());
  expect(secondRun).toEqual([]);
  expect(await remindersFor(loan._id)).toEqual(afterFirst);

  const events = await tableRows<AutomationEvent>("automationEvents");
  const reminderEvents = events.filter(
    (event) => event.loanId === loan._id && event.kind === "reminder",
  );
  expect(reminderEvents).toHaveLength(1);
  expect(reminderEvents[0]!.status).toBe("sent");

  const containerLog = (await n8nLogLines()).join("\n");
  expect(containerLog.includes(row.borrowerEmail)).toBe(false);
});
