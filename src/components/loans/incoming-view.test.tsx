import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { IncomingView } from "./incoming-view";

let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/incoming",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/use-utc-today", () => ({
  useUtcToday: () => "2026-06-15",
}));

const loan = (extra: object) => ({
  _id: "loan1",
  toolName: "Ladder",
  borrowerFirstName: "Amaka",
  ownerFirstName: "Tunde",
  startDate: "2026-06-15",
  endDate: "2026-06-17",
  status: "pending",
  contactEmail: null,
  hasStarted: false,
  isOverdue: false,
  latestActivity: null,
  ...extra,
});

beforeEach(() => {
  search = "";
  convex.useMutation.mockReturnValue(vi.fn());
  convex.useQuery.mockReturnValue(0);
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
});

test("opens on Needs reply, and only that tab loads", () => {
  render(<IncomingView />);
  expect(screen.getByRole("tab", { name: "Needs reply" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(convex.usePaginatedQuery).toHaveBeenCalledTimes(1);
  expect(convex.usePaginatedQuery.mock.calls[0]?.[1]).toEqual({
    today: "2026-06-15",
    group: "pending",
  });
});

test("shows a loading state before the first page", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([], "LoadingFirstPage"));
  render(<IncomingView />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
});

test.each([
  ["", "Nothing is waiting for your reply."],
  ["tab=approved", "No loans are out or booked."],
  ["tab=past", "You have no past requests yet."],
])("%s has its own empty message", (query, message) => {
  search = query;
  render(<IncomingView />);
  expect(screen.getByText(message)).toBeInTheDocument();
});

test("the count on Needs reply says how many wait, and 100+ past the limit", () => {
  convex.useQuery.mockReturnValue(3);
  const { unmount } = render(<IncomingView />);
  expect(screen.getByRole("tab", { name: "Needs reply (3)" })).toBeVisible();
  unmount();
  convex.useQuery.mockReturnValue(101);
  render(<IncomingView />);
  expect(screen.getByRole("tab", { name: "Needs reply (100+)" })).toBeVisible();
});

test.each([
  [{ status: "approved", hasStarted: true }, /with Amaka/],
  [{ status: "approved", hasStarted: false }, /booked by Amaka/],
])(
  "an approved loan names the person by where it stands: %o",
  (state, text) => {
    search = "tab=approved";
    convex.usePaginatedQuery.mockReturnValue(paginated([loan(state)]));
    render(<IncomingView />);
    expect(screen.getByText(text)).toBeInTheDocument();
  },
);

test("the next step depends on where the loan stands", () => {
  search = "tab=approved";
  convex.usePaginatedQuery.mockReturnValue(
    paginated([
      loan({
        status: "approved",
        hasStarted: true,
        isOverdue: true,
        contactEmail: "amaka@example.com",
      }),
    ]),
  );
  render(<IncomingView />);
  expect(screen.getByText(/Ask Amaka to return it:/)).toBeInTheDocument();
});
