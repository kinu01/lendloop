import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { BoardView } from "./board-view";

let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/use-utc-today", () => ({
  useUtcToday: () => "2026-06-15",
}));

beforeEach(() => {
  search = "";
  convex.useMutation.mockReturnValue(vi.fn());
});

test("shows a loading state before the first page", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([], "LoadingFirstPage"));
  render(<BoardView />);
  expect(screen.getByText("Loading tools…")).toBeInTheDocument();
});

test("an empty board points to My listings", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  render(<BoardView />);
  expect(screen.getByText(/List one under My listings/)).toBeInTheDocument();
});

test("an empty category says so", () => {
  search = "category=garden";
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  render(<BoardView />);
  expect(
    screen.getByText("No tools are listed in this category."),
  ).toBeInTheDocument();
});

test("passes today and the category from the URL to the query", () => {
  search = "category=garden";
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  render(<BoardView />);
  expect(convex.usePaginatedQuery.mock.calls[0]?.[1]).toEqual({
    today: "2026-06-15",
    category: "garden",
  });
});

test("choosing a category writes it to the URL", async () => {
  const replace = vi.spyOn(window.history, "replaceState");
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  render(<BoardView />);
  await userEvent.selectOptions(screen.getByLabelText("Category"), "garden");
  expect(replace).toHaveBeenCalledWith(null, "", "/board?category=garden");
  replace.mockRestore();
});

test("counts a partly loaded list honestly", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([], "CanLoadMore"));
  render(<BoardView />);
  expect(screen.getByRole("status")).toHaveTextContent("First 0 tools shown");
});
