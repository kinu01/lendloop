import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LoanList, type LoanRow } from "./loan-list";

const loan = {
  _id: "loan1",
  _creationTime: 0,
  toolId: "tool1",
  toolName: "Ladder",
  toolRemoved: false,
  borrowerFirstName: "Amaka",
  ownerFirstName: "Tunde",
  startDate: "2026-06-15",
  endDate: "2026-06-17",
  status: "pending",
  contactEmail: null,
  hasStarted: false,
  isOverdue: false,
  latestActivity: null,
} as unknown as LoanRow;

const base = {
  viewer: "owner",
  empty: "Nothing yet.",
  person: (row: LoanRow) => `requested by ${row.borrowerFirstName}`,
} as const;

test("shows the empty message when there are no loans", () => {
  render(<LoanList {...base} loans={[]} />);
  expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
});

test("shows a loading state before the data arrives", () => {
  render(<LoanList {...base} loans={undefined} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
});

test("shows the tool, dates, person and status", () => {
  render(<LoanList {...base} loans={[loan]} />);
  const row = within(screen.getByRole("listitem"));
  expect(row.getByRole("heading", { name: "Ladder" })).toBeInTheDocument();
  expect(row.getByText(/requested by Amaka/)).toBeInTheDocument();
  expect(row.getByText("Pending")).toBeInTheDocument();
});

test("names a removed tool, and can hide the status inside a titled group", () => {
  render(
    <LoanList
      {...base}
      hideStatus
      headingLevel={3}
      loans={[{ ...loan, toolRemoved: true }]}
    />,
  );
  expect(
    screen.getByRole("heading", { level: 3, name: /Ladder.*removed/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Pending")).toBeNull();
});

test("shows a contact email only when the server sent one", () => {
  const nextStep = vi.fn(() => "Reach Amaka at:");
  const { rerender } = render(
    <LoanList {...base} nextStep={nextStep} loans={[loan]} />,
  );
  expect(screen.queryByRole("link")).toBeNull();
  rerender(
    <LoanList
      {...base}
      nextStep={nextStep}
      loans={[{ ...loan, contactEmail: "amaka@example.com" }]}
    />,
  );
  expect(
    screen.getByRole("link", { name: "amaka@example.com" }),
  ).toHaveAttribute("href", "mailto:amaka@example.com");
});
