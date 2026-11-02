import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { convex } from "@/test/convex-mock";
import { ListingCard } from "./listing-card";

vi.mock("next/navigation", () => ({ usePathname: () => "/listings" }));

type Tool = Parameters<typeof ListingCard>[0]["tool"];

const tool = {
  _id: "tool1",
  _creationTime: 0,
  name: "Ladder",
  category: "garden",
  condition: "good",
  description: "Tall.",
  availability: "available",
  dueBack: null,
  bookings: [],
  nextBooking: null,
} as unknown as Tool;

const mutate = vi.fn(() => Promise.resolve());

beforeEach(() => {
  mutate.mockClear();
  convex.useMutation.mockReturnValue(mutate);
});

test("a free tool can be edited and removed", async () => {
  render(<ListingCard tool={tool} />);
  expect(screen.getByRole("button", { name: "Edit: Ladder" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Remove: Ladder" }));
  await userEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
  expect(mutate).toHaveBeenCalledWith({ toolId: "tool1" });
});

test("a tool with a booking cannot be removed, and says why", () => {
  const booked = { startDate: "2026-06-20", endDate: "2026-06-21" };
  render(
    <ListingCard tool={{ ...tool, bookings: [booked], nextBooking: booked }} />,
  );
  expect(screen.queryByRole("button", { name: "Remove: Ladder" })).toBeNull();
  expect(
    screen.getByText("You can remove this tool after its loans end."),
  ).toBeInTheDocument();
  expect(screen.getByText(/Next booking:/)).toBeInTheDocument();
});

test("Edit opens filled in, and saves to this tool", async () => {
  render(<ListingCard tool={tool} />);
  await userEvent.click(screen.getByRole("button", { name: "Edit: Ladder" }));
  expect(screen.getByLabelText("Name")).toHaveValue("Ladder");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mutate).toHaveBeenCalledWith({
    toolId: "tool1",
    name: "Ladder",
    category: "garden",
    condition: "good",
    description: "Tall.",
  });
});
