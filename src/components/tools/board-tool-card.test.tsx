import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { convex } from "@/test/convex-mock";
import { BoardToolCard } from "./board-tool-card";

vi.mock("next/navigation", () => ({ usePathname: () => "/board" }));

type Tool = Parameters<typeof BoardToolCard>[0]["tool"];

const tool = {
  _id: "tool1",
  name: "Ladder",
  category: "garden",
  condition: "good",
  description: "Tall.",
  availability: "available",
  dueBack: null,
  bookings: [],
  nextBooking: null,
  myPendingRequest: null,
  ownerFirstName: "Tunde",
  ownerIsTrustedLender: false,
  isMine: false,
} as unknown as Tool;

beforeEach(() => {
  convex.useMutation.mockReturnValue(vi.fn());
});

const borrow = () =>
  screen.queryByRole("button", { name: "Request to borrow: Ladder" });

test("shows the details and offers to borrow", () => {
  render(<BoardToolCard tool={tool} />);
  expect(screen.getByRole("heading", { name: "Ladder" })).toBeInTheDocument();
  expect(screen.getByText("Garden · Good condition")).toBeInTheDocument();
  expect(screen.getByText(/Lent by Tunde/)).toBeInTheDocument();
  expect(borrow()).toBeInTheDocument();
});

test("my own tool offers no actions, and says it is mine", () => {
  render(<BoardToolCard tool={{ ...tool, isMine: true }} />);
  expect(borrow()).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText(/Lent by you/)).toBeInTheDocument();
});

test("a pending request replaces the offer with its dates", () => {
  render(
    <BoardToolCard
      tool={{
        ...tool,
        myPendingRequest: { startDate: "2026-06-15", endDate: "2026-06-17" },
      }}
    />,
  );
  expect(borrow()).toBeNull();
  expect(screen.getByRole("link", { name: "My requests" })).toBeInTheDocument();
});

test("a tool on loan says when it is due back", () => {
  render(
    <BoardToolCard
      tool={{ ...tool, availability: "on_loan", dueBack: "2026-06-20" }}
    />,
  );
  expect(screen.getByText("On loan")).toBeInTheDocument();
  expect(screen.getByText(/Due back/)).toBeInTheDocument();
});

test("the Trusted Lender badge follows the owner", () => {
  render(<BoardToolCard tool={{ ...tool, ownerIsTrustedLender: true }} />);
  expect(screen.getByText("Trusted Lender")).toBeInTheDocument();
});
