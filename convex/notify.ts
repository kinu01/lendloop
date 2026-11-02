import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { env, internalAction, internalQuery } from "./_generated/server";
import { signedHeaders } from "./lib/hmac";
import { logWarning } from "./lib/log";
import { firstName } from "./lib/names";
import {
  loanEvent,
  type DeliveryProblem,
  type LoanEvent,
} from "./lib/validators";

const RETRY_DELAYS_MS = [10_000, 60_000, 300_000];
const REQUEST_TIMEOUT_MS = 10_000;
// A retry can land minutes later, when "approved" would hand out the owner's email on a dead loan.
const STILL_TRUE_ONLY_WHILE: Partial<
  Record<LoanEvent, Doc<"loans">["status"]>
> = { created: "pending", approved: "approved" };

export const buildPayload = internalQuery({
  args: { loanId: v.id("loans"), event: loanEvent, changedAt: v.number() },
  handler: async (ctx, { loanId, event, changedAt }) => {
    const loan = await ctx.db.get("loans", loanId);
    if (!loan) return null;
    const requiredStatus = STILL_TRUE_ONLY_WHILE[event];
    if (requiredStatus && loan.status !== requiredStatus) return null;
    const toOwner = event === "created" || event === "cancelled";
    const [tool, recipient] = await Promise.all([
      ctx.db.get("tools", loan.toolId),
      ctx.db.get("users", toOwner ? loan.ownerId : loan.borrowerId),
    ]);
    if (!tool || !recipient) return null;
    const owner =
      event === "approved" ? await ctx.db.get("users", loan.ownerId) : null;
    return {
      eventId: `${loanId}:${event}:${changedAt}`,
      event,
      loanId,
      recipient: {
        firstName: firstName(recipient.name),
        email: recipient.email,
      },
      toolName: tool.name,
      startDate: loan.startDate,
      endDate: loan.endDate,
      ...(owner
        ? { contact: { firstName: firstName(owner.name), email: owner.email } }
        : {}),
    };
  },
});

export const sendRequestEvent = internalAction({
  args: {
    loanId: v.id("loans"),
    event: loanEvent,
    changedAt: v.number(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const { loanId, event, attempt } = args;
    const url = env.N8N_WEBHOOK_URL;
    const secret = env.CONVEX_TO_N8N_SECRET;
    if (!url || !secret) {
      await ctx.runMutation(internal.automation.recordNotification, {
        loanId,
        event,
        status: "failed",
        attempt,
        willRetry: false,
        problem: "not_configured",
      });
      return;
    }

    const payload = await ctx.runQuery(internal.notify.buildPayload, {
      loanId,
      event,
      changedAt: args.changedAt,
    });
    if (!payload) {
      logWarning("notification_skipped", { loanId, event, attempt });
      return;
    }

    const body = JSON.stringify(payload);
    let problem: DeliveryProblem;
    let httpStatus: number | undefined;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await signedHeaders(secret, "POST", new URL(url).pathname, body)),
        },
        body,
        // A redirect would send the signed payload to another host.
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        await ctx.runMutation(internal.automation.recordNotification, {
          loanId,
          event,
          status: "sent",
          attempt,
          willRetry: false,
        });
        return;
      }
      problem = "http_error";
      httpStatus = response.status;
    } catch (error) {
      problem =
        error instanceof Error && error.name === "TimeoutError"
          ? "timed_out"
          : "unreachable";
    }

    const delay = RETRY_DELAYS_MS[attempt - 1];
    logWarning("notification_failed", {
      loanId,
      event,
      attempt,
      problem,
      httpStatus,
    });
    await ctx.runMutation(internal.automation.recordNotification, {
      loanId,
      event,
      status: "failed",
      attempt,
      willRetry: delay !== undefined,
      problem,
      httpStatus,
    });
    if (delay !== undefined) {
      await ctx.scheduler.runAfter(delay, internal.notify.sendRequestEvent, {
        ...args,
        attempt: attempt + 1,
      });
    }
  },
});
