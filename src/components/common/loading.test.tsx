import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Loading } from "./loading";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("stays quiet at first", () => {
  render(<Loading label="Loading tools…" />);
  expect(screen.getByRole("status").textContent).toBe("Loading tools…");
  expect(screen.queryByRole("button")).toBeNull();
});

test("offers a way out once the wait gets long", () => {
  render(<Loading />);
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(screen.getByRole("status").textContent).toContain(
    "taking longer than usual",
  );
  expect(screen.getByRole("button", { name: "Reload the page" })).toBeTruthy();
});
