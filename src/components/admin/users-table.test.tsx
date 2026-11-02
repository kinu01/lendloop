import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { convex, paginated } from "@/test/convex-mock";
import { UsersTable } from "./users-table";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

beforeEach(() => {
  convex.useMutation.mockReturnValue(vi.fn());
});

test("lists people with their role, and marks a Trusted Lender", () => {
  convex.usePaginatedQuery.mockReturnValue(
    paginated([
      {
        _id: "user1",
        name: "Amaka Obi",
        email: "amaka@example.com",
        role: "admin",
        isTrustedLender: true,
      },
    ]),
  );
  render(
    <>
      <h2 id="people-heading">People</h2>
      <UsersTable />
    </>,
  );
  const row = within(screen.getAllByRole("row")[1]!);
  expect(row.getByRole("rowheader", { name: "Amaka Obi" })).toBeInTheDocument();
  expect(row.getByText("Admin")).toBeInTheDocument();
  expect(
    row.getByRole("switch", { name: "Trusted Lender: Amaka Obi" }),
  ).toBeChecked();
  expect(screen.getByRole("region", { name: "People" })).toHaveAttribute(
    "tabindex",
    "0",
  );
});
