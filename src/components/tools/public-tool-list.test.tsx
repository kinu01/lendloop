import type { Preloaded } from "convex/react";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { convex } from "@/test/convex-mock";
import { PublicToolList } from "./public-tool-list";

const refresh = vi.fn();
let signedIn = false;

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/hooks/use-utc-today", () => ({
  useUtcToday: () => "2026-06-15",
}));
vi.mock("@clerk/nextjs", () => ({
  Show: ({ when, children }: { when: string; children: ReactNode }) =>
    (when === "signed-in") === signedIn ? children : null,
  SignInButton: ({ children }: { children: ReactNode }) => children,
}));

const preloaded = {} as Preloaded<never>;
const tools = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `tool${i}`,
    name: `Tool ${i}`,
    category: "garden",
  }));

function list(count: number, hasMore = false) {
  convex.usePreloadedQuery.mockReturnValue({ tools: tools(count), hasMore });
}

beforeEach(() => {
  refresh.mockClear();
  signedIn = false;
});

test("shows only name and category, with no heading per row", () => {
  list(1);
  render(<PublicToolList preloaded={preloaded} today="2026-06-15" />);
  expect(screen.getByRole("listitem").children).toHaveLength(2);
  expect(screen.getByText("Tool 0")).toBeInTheDocument();
  expect(screen.getByText("Garden")).toBeInTheDocument();
  expect(screen.queryByRole("heading")).toBeNull();
});

test("an empty list invites a signed-out visitor to lend", () => {
  list(0);
  render(<PublicToolList preloaded={preloaded} today="2026-06-15" />);
  expect(screen.getByText(/Sign in to be the first/)).toBeInTheDocument();
});

test("an empty list does not ask a signed-in person to sign in", () => {
  signedIn = true;
  list(0);
  render(<PublicToolList preloaded={preloaded} today="2026-06-15" />);
  expect(screen.getByText(/No tools are available/)).toBeInTheDocument();
  expect(screen.queryByText(/Sign in/)).toBeNull();
});

test("says the list is cut off only when more tools exist, even at exactly 24", () => {
  list(24, false);
  render(<PublicToolList preloaded={preloaded} today="2026-06-15" />);
  expect(screen.queryByText(/newest 24/)).toBeNull();
});

test("a signed-out visitor gets a real button to sign in for the rest", () => {
  list(24, true);
  render(<PublicToolList preloaded={preloaded} today="2026-06-15" />);
  expect(
    screen.getByRole("button", { name: "Sign in to see them all" }),
  ).toBeInTheDocument();
});

test("a signed-in person gets a link to the board instead", () => {
  signedIn = true;
  list(24, true);
  render(<PublicToolList preloaded={preloaded} today="2026-06-15" />);
  expect(screen.getByRole("link", { name: "See them all" })).toHaveAttribute(
    "href",
    "/board",
  );
  expect(screen.queryByRole("button")).toBeNull();
});

test("asks the server for fresh data when the day changes", () => {
  list(0);
  const { rerender } = render(
    <PublicToolList preloaded={preloaded} today="2026-06-15" />,
  );
  expect(refresh).not.toHaveBeenCalled();
  rerender(<PublicToolList preloaded={preloaded} today="2026-06-14" />);
  expect(refresh).toHaveBeenCalledTimes(1);
});
