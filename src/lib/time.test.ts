import { expect, test } from "vitest";
import { timeAgo } from "./time";

const now = Date.parse("2026-06-15T10:00:00Z");

test("timeAgo reads naturally", () => {
  expect(timeAgo(now - 20_000, now)).toBe("just now");
  expect(timeAgo(now - 5 * 60_000, now)).toBe("5 minutes ago");
  expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 hours ago");
  expect(timeAgo(now - 86_400_000, now)).toBe("yesterday");
  expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2 days ago");
});
