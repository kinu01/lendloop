import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

vi.mock("next/navigation", () => ({ usePathname: () => "/incoming" }));

afterEach(cleanup);

function setup(onConfirm = vi.fn(() => Promise.resolve())) {
  render(
    <ConfirmDialog
      label="Decline"
      subject="Ladder"
      question="Decline Amaka's request for Ladder?"
      confirmLabel="Yes, decline"
      danger
      doneMessage="Declined."
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, user: userEvent.setup() };
}

const opener = () => screen.getByRole("button", { name: "Decline: Ladder" });

test("asks first, puts focus on the safe choice, and acts only on confirm", async () => {
  const { onConfirm, user } = setup();
  await user.click(opener());
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Go back" }),
  );
  await user.click(screen.getByRole("button", { name: "Yes, decline" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("Go back closes without acting and returns focus to the opener", async () => {
  const { onConfirm, user } = setup();
  await user.click(opener());
  await user.click(screen.getByRole("button", { name: "Go back" }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(opener());
});

test("Escape closes without acting", async () => {
  const { onConfirm, user } = setup();
  await user.click(opener());
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test("a failed action stays open, shows the error, and clears it on reopening", async () => {
  const { user } = setup(vi.fn(() => Promise.reject(new Error("boom"))));
  await user.click(opener());
  await user.click(screen.getByRole("button", { name: "Yes, decline" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Something went wrong. Please try again.",
  );
  await user.click(screen.getByRole("button", { name: "Go back" }));
  await user.click(opener());
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a double click on confirm runs the action once", async () => {
  const onConfirm = vi.fn(() => new Promise(() => {}));
  const { user } = setup(onConfirm as never);
  await user.click(opener());
  await user.dblClick(screen.getByRole("button", { name: "Yes, decline" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
