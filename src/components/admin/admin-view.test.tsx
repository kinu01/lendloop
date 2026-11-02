import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { AdminView } from "./admin-view";

let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/use-utc-today", () => ({
  useUtcToday: () => "2026-06-15",
}));

beforeEach(() => {
  search = "";
  convex.useMutation.mockReturnValue(vi.fn());
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
});

test("shows a loading state until the role is known", () => {
  convex.useQuery.mockReturnValue(undefined);
  render(<AdminView />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
});

test("a user sees a plain message, and no admin data is requested", () => {
  convex.useQuery.mockReturnValue({ role: "user" });
  render(<AdminView />);
  expect(screen.getByText("This page is for admins only.")).toBeInTheDocument();
  expect(convex.usePaginatedQuery).not.toHaveBeenCalled();
});

test("an admin sees four tabs, opening on Listings, and only that tab loads", () => {
  convex.useQuery.mockReturnValue({ role: "admin" });
  render(<AdminView />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Listings",
    "Loans",
    "People",
    "Failures",
  ]);
  expect(screen.getByRole("tab", { name: "Listings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByText("No tools are listed yet.")).toBeInTheDocument();
  expect(screen.queryByText("There are no loans yet.")).toBeNull();
  expect(screen.queryByText("There are no automation failures.")).toBeNull();
});

test("opens the tab named in the URL", () => {
  search = "tab=failures";
  convex.useQuery.mockReturnValue({ role: "admin" });
  render(<AdminView />);
  expect(
    screen.getByText("There are no automation failures."),
  ).toBeInTheDocument();
});

test("pressing a tab writes it to the URL", async () => {
  const replace = vi.spyOn(window.history, "replaceState");
  convex.useQuery.mockReturnValue({ role: "admin" });
  render(<AdminView />);
  await userEvent.click(screen.getByRole("tab", { name: "People" }));
  expect(replace).toHaveBeenCalledWith(null, "", "/admin?tab=people");
  replace.mockRestore();
});
