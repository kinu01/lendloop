import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AvailabilityBadge, StatusBadge } from "./status-badge";

test.each([
  [{ status: "pending", isOverdue: false, hasStarted: false }, "Pending"],
  [{ status: "approved", isOverdue: false, hasStarted: false }, "Booked"],
  [{ status: "approved", isOverdue: false, hasStarted: true }, "On loan"],
  [{ status: "approved", isOverdue: true, hasStarted: true }, "Overdue"],
  [{ status: "returned", isOverdue: false, hasStarted: true }, "Returned"],
] as const)("%o reads %s", (props, label) => {
  render(<StatusBadge {...props} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});

test("availability reads as a word, not only a color", () => {
  const { rerender } = render(<AvailabilityBadge availability="available" />);
  expect(screen.getByText("Available")).toBeInTheDocument();
  rerender(<AvailabilityBadge availability="on_loan" />);
  expect(screen.getByText("On loan")).toBeInTheDocument();
});
