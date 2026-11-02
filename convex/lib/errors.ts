import { ConvexError } from "convex/values";

export type ErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "RATE_LIMITED";

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}
