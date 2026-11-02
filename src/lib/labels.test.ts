import { expect, test } from "vitest";
import {
  formatDate,
  formatRange,
  formatWaitingCount,
  isCategory,
} from "./labels";

test("formatDate reads as a day, a short month and a year, in UTC", () => {
  expect(formatDate("2026-11-04")).toBe("4 Nov 2026");
});

test("formatRange joins the dates without repeating the shared parts", () => {
  // Node versions space the dash differently, and the spacing is not ours to pin.
  const range = (start: string, end: string) =>
    formatRange(start, end).replace(/\s*–\s*/, "–");
  expect(range("2026-11-04", "2026-11-06")).toBe("4–6 Nov 2026");
  expect(range("2026-10-30", "2026-11-02")).toBe("30 Oct–2 Nov 2026");
  expect(formatRange("2026-11-04", "2026-11-04")).toBe("4 Nov 2026");
});

test("isCategory accepts only the fixed list", () => {
  expect(isCategory("garden")).toBe(true);
  expect(isCategory("weapons")).toBe(false);
  expect(isCategory(null)).toBe(false);
});

test("the waiting count says 100+ past its limit", () => {
  expect(formatWaitingCount(100)).toBe("100");
  expect(formatWaitingCount(101)).toBe("100+");
});
