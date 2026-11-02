import type { Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { convex } from "@/test/convex-mock";
import { BorrowerActions, OwnerActions } from "./loan-actions";

const shared = {
  loanId: "loan1" as Id<"loans">,
  toolName: "Ladder",
};
const owner = { ...shared, borrower: "Amaka" };
const mutate = vi.fn(() => Promise.resolve());

beforeEach(() => {
  mutate.mockClear();
  convex.useMutation.mockReturnValue(mutate);
});

const names = () =>
  screen.queryAllByRole("button").map((button) => button.textContent);

test("a pending request offers Approve and Decline, and Approve acts at once", async () => {
  render(<OwnerActions {...owner} status="pending" hasStarted={false} />);
  expect(names()).toEqual(["Approve", "Decline"]);
  await userEvent.click(
    screen.getByRole("button", { name: "Approve: Ladder" }),
  );
  expect(mutate).toHaveBeenCalledWith({ loanId: shared.loanId });
});

test("a started loan offers only Mark as returned, after a question", async () => {
  render(<OwnerActions {...owner} status="approved" hasStarted />);
  expect(names()).toEqual(["Mark as returned"]);
  await userEvent.click(screen.getByRole("button"));
  expect(mutate).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Yes, it is back" }),
  );
  expect(mutate).toHaveBeenCalledTimes(1);
});

test("an approved loan that has not started can only be called off", () => {
  render(<OwnerActions {...owner} status="approved" hasStarted={false} />);
  expect(names()).toEqual(["Call off this loan"]);
});

test.each(["declined", "cancelled", "returned"] as const)(
  "a %s loan offers the owner nothing",
  (status) => {
    render(<OwnerActions {...owner} status={status} hasStarted />);
    expect(names()).toEqual([]);
  },
);

test("a borrower can cancel a pending request or a loan not yet started", () => {
  const { rerender } = render(
    <BorrowerActions {...shared} status="pending" hasStarted={false} />,
  );
  expect(names()).toEqual(["Cancel request"]);
  rerender(
    <BorrowerActions {...shared} status="approved" hasStarted={false} />,
  );
  expect(names()).toEqual(["Cancel loan"]);
});

test("a borrower cannot cancel a loan under way", () => {
  render(<BorrowerActions {...shared} status="approved" hasStarted />);
  expect(names()).toEqual([]);
});

test("a failed approval shows why", async () => {
  mutate.mockRejectedValueOnce(new Error("boom"));
  render(<OwnerActions {...owner} status="pending" hasStarted={false} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Approve: Ladder" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Something went wrong",
  );
});
