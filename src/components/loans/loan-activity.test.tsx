import type { Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Activity } from "@/lib/activity";
import { convex } from "@/test/convex-mock";
import { LoanActivity } from "./loan-activity";

const loanId = "loan1" as Id<"loans">;
const reminder = {
  _id: "event1" as Id<"automationEvents">,
  at: Date.now(),
  kind: "reminder",
  status: "sent",
} satisfies Activity;

test("shows nothing before any automation has run", () => {
  const { container } = render(
    <LoanActivity loanId={loanId} latest={null} viewer="owner" />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("speaks to the viewer in the summary", () => {
  render(<LoanActivity loanId={loanId} latest={reminder} viewer="borrower" />);
  expect(screen.getByText(/Latest update: You were reminded/)).toBeVisible();
});

test("loads the history only when opened", async () => {
  convex.useQuery.mockReturnValue([reminder, reminder]);
  render(<LoanActivity loanId={loanId} latest={reminder} viewer="owner" />);
  expect(convex.useQuery).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText(/Latest update/));
  expect(convex.useQuery).toHaveBeenCalled();
});

test("marks a failed update as a failure", () => {
  render(
    <LoanActivity
      loanId={loanId}
      latest={{ ...reminder, status: "failed" }}
      viewer="owner"
    />,
  );
  expect(screen.getByText(/Could not remind the borrower/)).toHaveClass(
    "text-destructive",
  );
});
