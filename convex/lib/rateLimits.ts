import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail } from "./errors";

const limiter = new RateLimiter(components.rateLimiter, {
  // Each request notifies the owner, so request then cancel must not repeat forever.
  requestLoan: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  createTool: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
});

export async function resetRateLimits(ctx: MutationCtx, userId: Id<"users">) {
  await limiter.reset(ctx, "requestLoan", { key: userId });
  await limiter.reset(ctx, "createTool", { key: userId });
}

export async function requireWithinRateLimit(
  ctx: MutationCtx,
  name: "requestLoan" | "createTool",
  userId: Id<"users">,
) {
  const { ok } = await limiter.limit(ctx, name, { key: userId });
  if (!ok)
    fail("RATE_LIMITED", "You are doing that too often. Try again later.");
}
