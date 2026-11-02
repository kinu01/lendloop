import type { Id } from "@convex/_generated/dataModel";
import { addDays } from "@convex/lib/dates";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { localToday } from "@/lib/dates";
import { convex } from "@/test/convex-mock";
import { RequestDialog } from "./request-dialog";

vi.mock("next/navigation", () => ({ usePathname: () => "/board" }));

const toolId = "tool1" as Id<"tools">;
const today = localToday();
const request = vi.fn(() => Promise.resolve());

beforeEach(() => {
  request.mockClear();
  convex.useMutation.mockReturnValue(request);
});

async function open(bookings: { startDate: string; endDate: string }[] = []) {
  render(
    <RequestDialog toolId={toolId} toolName="Ladder" bookings={bookings} />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Request to borrow: Ladder" }),
  );
}

const from = () => screen.getByLabelText("From") as HTMLInputElement;
const to = () => screen.getByLabelText("To") as HTMLInputElement;
const setDate = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

test("opens on the first free dates, three days long", async () => {
  await open();
  expect(from().value).toBe(today);
  expect(to().value).toBe(addDays(today, 2));
});

test("skips a booking when choosing the first free dates", async () => {
  const end = addDays(today, 1);
  await open([{ startDate: today, endDate: end }]);
  expect(from().value).toBe(addDays(end, 1));
  expect(screen.getByText(/Already booked:/)).toBeInTheDocument();
});

test("moving the start past the end moves the end too", async () => {
  await open();
  const later = addDays(today, 10);
  setDate(from(), later);
  expect(to().value).toBe(later);
});

test("sends the chosen dates and closes", async () => {
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(request).toHaveBeenCalledWith({
    toolId,
    startDate: today,
    endDate: addDays(today, 2),
  });
});

test("dates overlapping a booking block sending, and say why", async () => {
  const start = addDays(today, 5);
  await open([{ startDate: start, endDate: addDays(start, 1) }]);
  setDate(from(), start);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /overlap a booking/,
  );
  expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
});

test("an end before the start shows the shared schema's message", async () => {
  await open();
  setDate(from(), addDays(today, 5));
  setDate(to(), addDays(today, 1));
  await userEvent.click(screen.getByRole("button", { name: "Send request" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The end date must be on or after the start date.",
  );
  expect(request).not.toHaveBeenCalled();
});

test("a server refusal stays open and shows the error", async () => {
  request.mockRejectedValueOnce(new Error("boom"));
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Send request" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Something went wrong",
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("Cancel closes without sending", async () => {
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
