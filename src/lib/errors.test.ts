import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { errorMessage } from "./errors";

test("shows the server's own message", () => {
  const error = new ConvexError({ code: "INVALID", message: "Too long." });
  expect(errorMessage(error)).toBe("Too long.");
});

test("falls back to a message for the code", () => {
  expect(errorMessage(new ConvexError({ code: "RATE_LIMITED" }))).toBe(
    "You are doing that too often. Try again later.",
  );
});

test("never shows an unexpected error's own text", () => {
  expect(errorMessage(new Error("secret internals"))).toBe(
    "Something went wrong. Please try again.",
  );
});
