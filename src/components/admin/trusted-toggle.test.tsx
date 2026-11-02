import type { Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { convex } from "@/test/convex-mock";
import { TrustedToggle } from "./trusted-toggle";

const userId = "user1" as Id<"users">;
const toggle = () =>
  screen.getByRole("switch", { name: "Trusted Lender: Amaka" });

test("shows the state and turns it on", async () => {
  const setTrusted = vi.fn(() => Promise.resolve());
  convex.useMutation.mockReturnValue(setTrusted);
  render(<TrustedToggle userId={userId} name="Amaka" trusted={false} />);
  expect(toggle()).not.toBeChecked();
  await userEvent.click(toggle());
  expect(setTrusted).toHaveBeenCalledWith({ userId, trusted: true });
});

test("turns it off", async () => {
  const setTrusted = vi.fn(() => Promise.resolve());
  convex.useMutation.mockReturnValue(setTrusted);
  render(<TrustedToggle userId={userId} name="Amaka" trusted />);
  expect(toggle()).toBeChecked();
  await userEvent.click(toggle());
  expect(setTrusted).toHaveBeenCalledWith({ userId, trusted: false });
});

test("a failed change keeps the server's value and shows the error", async () => {
  convex.useMutation.mockReturnValue(
    vi.fn(() => Promise.reject(new Error("boom"))),
  );
  render(<TrustedToggle userId={userId} name="Amaka" trusted={false} />);
  await userEvent.click(toggle());
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(toggle()).not.toBeChecked();
});
