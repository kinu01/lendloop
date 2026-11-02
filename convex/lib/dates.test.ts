import { describe, expect, test } from "vitest";
import { addDays, isIsoDate, rangesOverlap, todayUtc } from "./dates";

describe("dates", () => {
  test("todayUtc uses the UTC date, not the local one", () => {
    expect(todayUtc(Date.parse("2026-06-15T23:59:59Z"))).toBe("2026-06-15");
    expect(todayUtc(Date.parse("2026-06-16T00:00:00Z"))).toBe("2026-06-16");
  });

  test("isIsoDate rejects bad shapes and impossible dates", () => {
    expect(isIsoDate("2026-06-15")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-6-15")).toBe(false);
    expect(isIsoDate("2026-06-15T00:00:00Z")).toBe(false);
  });

  test("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("rangesOverlap treats touching days as overlap", () => {
    const a = { startDate: "2026-06-10", endDate: "2026-06-15" };
    expect(
      rangesOverlap(a, { startDate: "2026-06-15", endDate: "2026-06-20" }),
    ).toBe(true);
    expect(
      rangesOverlap(a, { startDate: "2026-06-16", endDate: "2026-06-20" }),
    ).toBe(false);
  });
});
