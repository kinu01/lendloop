import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { ListingsTable } from "./listings-table";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/hooks/use-utc-today", () => ({
  useUtcToday: () => "2026-06-15",
}));

const tool = {
  _id: "tool1",
  name: "Ladder",
  category: "garden",
  ownerFirstName: "Olu",
  availability: "available",
  bookings: [],
};
const remove = vi.fn(() => Promise.resolve());

beforeEach(() => {
  remove.mockClear();
  convex.useMutation.mockReturnValue(remove);
});

function renderTable() {
  render(
    <>
      <h2 id="listings-heading">Listings</h2>
      <ListingsTable />
    </>,
  );
}

test("says when no tools are listed", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([]));
  renderTable();
  expect(screen.getByText("No tools are listed yet.")).toBeInTheDocument();
});

test("shows the tool, its owner and its status", () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([tool]));
  renderTable();
  expect(screen.getByRole("rowheader", { name: "Ladder" })).toBeVisible();
  expect(screen.getByText("Garden")).toBeInTheDocument();
  expect(screen.getByText("Olu")).toBeInTheDocument();
  expect(screen.getByText("Available")).toBeInTheDocument();
});

test("Remove asks first, then removes", async () => {
  convex.usePaginatedQuery.mockReturnValue(paginated([tool]));
  renderTable();
  await userEvent.click(screen.getByRole("button", { name: "Remove: Ladder" }));
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
  expect(remove).toHaveBeenCalledWith({ toolId: "tool1" });
});

test("warns about loans when the tool has any", async () => {
  convex.usePaginatedQuery.mockReturnValue(
    paginated([{ ...tool, availability: "on_loan" }]),
  );
  renderTable();
  await userEvent.click(screen.getByRole("button", { name: "Remove: Ladder" }));
  expect(screen.getByText(/stays open until the owner/)).toBeInTheDocument();
});
