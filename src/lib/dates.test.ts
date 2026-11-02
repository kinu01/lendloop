import { describe, expect, test } from "vitest";
import { firstFreeStart, localToday } from "./dates";

describe("dates", () => {
  test("firstFreeStart skips bookings that cover the default range", () => {
    const bookings = [
      { startDate: "2026-06-15", endDate: "2026-06-16" },
      { startDate: "2026-06-18", endDate: "2026-06-19" },
    ];
    expect(firstFreeStart(bookings, "2026-06-15", 3)).toBe("2026-06-20");
    expect(firstFreeStart([], "2026-06-15", 3)).toBe("2026-06-15");
  });

  test("localToday reads the local calendar day, with padding", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
