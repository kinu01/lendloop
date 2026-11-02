import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAnnounce } from "@/hooks/use-announce";
import { AnnouncerProvider } from "./announcer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger() {
  const announce = useAnnounce();
  return (
    <button onClick={() => announce("Approved. Amaka was told.")}>Go</button>
  );
}

function setup() {
  render(
    <main id="main" tabIndex={-1}>
      <AnnouncerProvider>
        <Trigger />
      </AnnouncerProvider>
    </main>,
  );
}

test("shows the message, then clears it", () => {
  vi.useFakeTimers();
  setup();
  act(() => {
    screen.getByText("Go").click();
    vi.advanceTimersByTime(100);
  });
  expect(screen.getByRole("status").textContent).toBe(
    "Approved. Amaka was told.",
  );
  act(() => {
    vi.advanceTimersByTime(6000);
  });
  expect(screen.getByRole("status").textContent).toBe("");
});

test("moves focus to main when the pressed button has gone", () => {
  vi.useFakeTimers();
  setup();
  (document.activeElement as HTMLElement | null)?.blur();
  act(() => {
    screen.getByText("Go").click();
    vi.runAllTimers();
  });
  expect(document.activeElement?.id).toBe("main");
});

test("leaves focus alone when it is still on a control", () => {
  vi.useFakeTimers();
  setup();
  const button = screen.getByText("Go");
  button.focus();
  act(() => {
    button.click();
    vi.runAllTimers();
  });
  expect(document.activeElement).toBe(button);
});
