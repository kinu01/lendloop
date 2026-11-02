import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { FailuresList } from "./failures-list";

const failure = {
  _id: "event1",
  at: Date.now(),
  toolName: "Ladder",
  workflow: "LendLoop: overdue reminders",
  executionId: "42",
  message: 'The step "Fetch overdue loans" failed.',
};

test("says when there are no failures", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  render(<FailuresList />);
  expect(
    screen.getByText("There are no automation failures."),
  ).toBeInTheDocument();
});

test("a failure with no n8n run shows no run number", () => {
  convex.usePaginatedQuery.mockReturnValue(
    paginated([{ ...failure, executionId: null }]),
  );
  render(<FailuresList />);
  expect(
    screen.getByText("LendLoop: overdue reminders failed"),
  ).toBeInTheDocument();
});

test("names the run and the tool, and keeps the detail behind a summary", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([failure]));
  render(<FailuresList />);
  expect(
    screen.getByText("LendLoop: overdue reminders run 42 failed"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Tool: Ladder/)).toBeInTheDocument();
  expect(screen.getByText("Technical detail")).toBeInTheDocument();
});
