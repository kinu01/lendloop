import { ConvexError } from "convex/values";

const FALLBACK: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in again.",
  FORBIDDEN: "You are not allowed to do that.",
  NOT_FOUND: "That item no longer exists.",
  INVALID: "Please check what you entered.",
  RATE_LIMITED: "You are doing that too often. Try again later.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: string; message?: string };
    return data.message ?? FALLBACK[data.code ?? ""] ?? "Something went wrong.";
  }
  return "Something went wrong. Please try again.";
}
