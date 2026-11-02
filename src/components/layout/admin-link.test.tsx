import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SessionContext } from "@/hooks/use-session";
import { convex } from "@/test/convex-mock";
import { AdminLink } from "./admin-link";

let pathname = "/board";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const session = {
  isLoading: false,
  isReady: true,
  error: null,
  needsSignIn: false,
  retry: vi.fn(),
};

function renderLink() {
  render(
    <SessionContext.Provider value={session}>
      <AdminLink />
    </SessionContext.Provider>,
  );
}

test("an admin sees the link", () => {
  convex.useQuery.mockReturnValue({ role: "admin" });
  renderLink();
  expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
    "href",
    "/admin",
  );
});

test.each([[{ role: "user" }], [undefined]])("%o sees nothing", (me) => {
  convex.useQuery.mockReturnValue(me);
  renderLink();
  expect(screen.queryByRole("link")).toBeNull();
});

test("is marked as current on the admin page", () => {
  pathname = "/admin";
  convex.useQuery.mockReturnValue({ role: "admin" });
  renderLink();
  expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  pathname = "/board";
});
