import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { RequestsView } from "./requests-view";

vi.mock("next/navigation", () => ({ usePathname: () => "/requests" }));

const loan = {
  _id: "loan1",
  toolName: "Ladder",
  borrowerFirstName: "Amaka",
  ownerFirstName: "Tunde",
  startDate: "2026-06-15",
  endDate: "2026-06-17",
  status: "approved",
  contactEmail: "tunde@example.com",
  hasStarted: false,
  isOverdue: false,
  latestActivity: null,
};

beforeEach(() => {
  convex.useMutation.mockReturnValue(vi.fn());
});

test("shows a loading state, then an empty message that points to the board", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([], "LoadingFirstPage"));
  const { rerender } = render(<RequestsView />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  rerender(<RequestsView />);
  expect(screen.getByText(/Find a tool under All tools/)).toBeInTheDocument();
});

test.each([
  [{ hasStarted: false, isOverdue: false }, /Arrange pickup with Tunde:/],
  [{ hasStarted: true, isOverdue: false }, /Reach Tunde at:/],
  [{ hasStarted: true, isOverdue: true }, /This is overdue/],
])("%o gives the right next step", (state, text) => {
  convex.usePaginatedQuery.mockReturnValue(paginated([{ ...loan, ...state }]));
  render(<RequestsView />);
  expect(screen.getByText(text)).toBeInTheDocument();
});
