import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { AllLoansTable } from "./all-loans-table";

const loan = {
  _id: "loan1",
  toolName: "Ladder",
  toolRemoved: true,
  borrowerFirstName: "Amaka",
  ownerFirstName: "Tunde",
  startDate: "2026-06-15",
  endDate: "2026-06-17",
  status: "pending",
  hasStarted: false,
  isOverdue: false,
  latestActivity: {
    _id: "event1",
    at: Date.now(),
    kind: "reminder",
    status: "sent",
  },
};

test("says when there are no loans", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  render(<AllLoansTable />);
  expect(screen.getByText("There are no loans yet.")).toBeInTheDocument();
});

test("shows both people, the status and the latest update, written for an admin", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([loan]));
  render(
    <>
      <h2 id="loans-heading">All loans</h2>
      <AllLoansTable />
    </>,
  );
  expect(
    screen.getByRole("rowheader", { name: /Ladder.*removed/ }),
  ).toBeVisible();
  expect(screen.getByText("Amaka")).toBeInTheDocument();
  expect(screen.getByText("Tunde")).toBeInTheDocument();
  expect(screen.getByText("Pending")).toBeInTheDocument();
  expect(screen.getByText(/The borrower was reminded/)).toBeInTheDocument();
});
