import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ErrorMessage } from "./error-message";

test("explains the problem, offers a retry and a way home", async () => {
  const reset = vi.fn();
  render(<ErrorMessage reset={reset} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "This page could not load.",
  );
  expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
    "href",
    "/",
  );
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledTimes(1);
});
