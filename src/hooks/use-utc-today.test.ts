import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useUtcToday } from "./use-utc-today";

afterEach(() => vi.useRealTimers());

test("gives the UTC date, and changes at UTC midnight without a reload", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T23:59:00Z"));
  const { result } = renderHook(() => useUtcToday());
  expect(result.current).toBe("2026-06-15");
  act(() => {
    vi.advanceTimersByTime(61_000);
  });
  expect(result.current).toBe("2026-06-16");
});
