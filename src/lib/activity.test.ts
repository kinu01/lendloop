import { describe, expect, test } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { describeActivity, type Activity } from "./activity";

const shared = {
  _id: "event1" as Id<"automationEvents">,
  at: 0,
};
const notification = {
  ...shared,
  kind: "notification",
  event: "created",
  status: "sent",
  attempt: 1,
  willRetry: false,
  problem: undefined,
  httpStatus: undefined,
} satisfies Activity;

describe("describeActivity", () => {
  test("speaks to the person it is about, and names them for anyone else", () => {
    expect(describeActivity(notification, "owner")).toBe(
      "You were told about this request.",
    );
    expect(describeActivity(notification, "borrower")).toBe(
      "The owner was told about this request.",
    );
    expect(describeActivity(notification, "admin")).toBe(
      "The owner was told about this request.",
    );
  });

  const failed = {
    ...notification,
    status: "failed",
    willRetry: true,
    problem: "http_error",
    httpStatus: 500,
  } satisfies Activity;
  const gaveUp = {
    ...failed,
    event: "approved",
    attempt: 4,
    willRetry: false,
    problem: "unreachable",
    httpStatus: undefined,
  } satisfies Activity;
  const notConfigured = {
    ...failed,
    willRetry: false,
    problem: "not_configured",
    httpStatus: undefined,
  } satisfies Activity;

  test("a neighbor hears about a retry in plain words", () => {
    expect(describeActivity(failed, "owner")).toBe(
      "We could not tell you yet. We will try again.",
    );
    expect(describeActivity(failed, "borrower")).toBe(
      "We could not tell the owner yet. We will try again.",
    );
  });

  test("a neighbor is told what to do when the attempts run out", () => {
    expect(describeActivity(gaveUp, "borrower")).toBe(
      "We could not tell you. Please check with your neighbor.",
    );
    expect(describeActivity(gaveUp, "owner")).toBe(
      "We could not tell the borrower. Please tell them yourself.",
    );
  });

  test.each([failed, gaveUp, notConfigured])(
    "a neighbor never sees our tools or error codes: %o",
    (activity) => {
      for (const viewer of ["owner", "borrower"] as const) {
        const text = describeActivity(activity, viewer);
        expect(text).not.toMatch(/n8n|HTTP|webhook|attempt/i);
      }
    },
  );

  test("an admin sees the technical cause", () => {
    expect(describeActivity(failed, "admin")).toBe(
      "Could not tell the owner on attempt 1 (HTTP 500); retrying.",
    );
    expect(describeActivity(gaveUp, "admin")).toBe(
      "Could not tell the borrower after 4 attempts (could not reach n8n).",
    );
    expect(describeActivity(notConfigured, "admin")).toContain(
      "not configured",
    );
  });

  test("describes reminders for the borrower and for others", () => {
    const sent = {
      ...shared,
      kind: "reminder",
      status: "sent",
    } satisfies Activity;
    expect(describeActivity(sent, "borrower")).toBe("You were reminded.");
    expect(describeActivity(sent, "owner")).toBe("The borrower was reminded.");
  });

  test("gives no technical detail about a failed run", () => {
    const failure = {
      ...shared,
      kind: "failure",
      status: "failed",
    } satisfies Activity;
    expect(describeActivity(failure, "owner")).toBe(
      "An automation run failed.",
    );
  });
});
