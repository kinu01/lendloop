import { afterEach, describe, expect, test, vi } from "vitest";
import {
  automationFailureBody,
  loanDates,
  parseOrFail,
  parseToday,
  reminderClaimBody,
  toolInput,
} from "./schemas";

afterEach(() => vi.useRealTimers());

const tool = {
  name: "Ladder",
  category: "garden",
  condition: "good",
  description: "",
};

describe("toolInput", () => {
  test("trims text", () => {
    expect(toolInput.parse({ ...tool, name: "  Saw " }).name).toBe("Saw");
  });

  test.each([
    ["a blank name", { name: "   " }],
    ["a name over 80 characters", { name: "x".repeat(81) }],
    ["a description over 500 characters", { description: "x".repeat(501) }],
    ["an unknown category", { category: "weapons" }],
  ])("rejects %s", (_, change) => {
    expect(toolInput.safeParse({ ...tool, ...change }).success).toBe(false);
  });
});

describe("loanDates", () => {
  test("accepts one day, and rejects an end before the start", () => {
    const day = { startDate: "2026-06-15", endDate: "2026-06-15" };
    expect(loanDates.safeParse(day).success).toBe(true);
    expect(loanDates.safeParse({ ...day, endDate: "2026-06-14" }).success).toBe(
      false,
    );
  });
});

describe("HTTP bodies", () => {
  test("a reminder date must be within a day of today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    const body = { loanId: "loan1", runId: "run1" };
    const dated = (reminderDate: string) =>
      reminderClaimBody.safeParse({ ...body, reminderDate }).success;
    expect(dated("2026-06-14")).toBe(true);
    expect(dated("2026-06-16")).toBe(true);
    expect(dated("2026-06-13")).toBe(false);
    expect(dated("2026-06-17")).toBe(false);
  });

  test("a failure message is cut, not refused", () => {
    const parsed = automationFailureBody.parse({
      workflow: "w",
      executionId: "1",
      message: "x".repeat(1000),
    });
    expect(parsed.message).toHaveLength(200);
  });
});

test("parseOrFail reports the first problem as INVALID", () => {
  expect(() => parseOrFail(toolInput, { ...tool, name: "" })).toThrow();
  expect(() => parseToday("yesterday")).toThrow();
  expect(parseToday("2026-06-15")).toBe("2026-06-15");
});
