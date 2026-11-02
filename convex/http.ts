import { httpRouter } from "convex/server";
import type { z } from "zod";
import { internal } from "./_generated/api";
import { env, httpAction, type ActionCtx } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "./lib/hmac";
import { logWarning } from "./lib/log";
import {
  automationFailureBody,
  reminderClaimBody,
  reminderRecordBody,
} from "./lib/schemas";

const http = httpRouter();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseBody<Schema extends z.ZodType>(
  schema: Schema,
  raw: string,
): z.output<Schema> | null {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

type Handler = (ctx: ActionCtx, body: string) => Promise<Response>;

function signed(handler: Handler) {
  return httpAction(async (ctx, request) => {
    const secret = env.N8N_TO_CONVEX_SECRET;
    if (!secret) return json(500, { error: "not configured" });
    const body = await request.text();
    const path = new URL(request.url).pathname;
    const check = await verify({
      secret,
      timestamp: request.headers.get(TIMESTAMP_HEADER),
      signature: request.headers.get(SIGNATURE_HEADER),
      method: request.method,
      path,
      body,
    });
    if (!check.ok) {
      logWarning("signature_rejected", { path, reason: check.reason });
      return json(401, { error: "invalid signature" });
    }
    return handler(ctx, body);
  });
}

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: signed(async (ctx) => {
    const date = todayUtc();
    const { loans, truncated } = await ctx.runQuery(
      internal.reminders.listOverdue,
      { date },
    );
    if (truncated) logWarning("overdue_feed_truncated", { date });
    return json(200, { date, loans, truncated });
  }),
});

http.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: signed(async (ctx, raw) => {
    const body = parseBody(reminderRecordBody, raw);
    if (!body) return json(400, { error: "invalid body" });
    const { result } = await ctx.runMutation(internal.reminders.record, body);
    if (result === "not_found") return json(404, { error: "unknown loan" });
    return json(200, { ok: true, duplicate: result === "duplicate" });
  }),
});

http.route({
  path: "/n8n/reminders/claim",
  method: "POST",
  handler: signed(async (ctx, raw) => {
    const body = parseBody(reminderClaimBody, raw);
    if (!body) return json(400, { error: "invalid body" });
    const { result } = await ctx.runMutation(internal.reminders.claim, body);
    if (result === "not_found") return json(404, { error: "unknown loan" });
    return json(200, { claimed: result === "claimed" });
  }),
});

http.route({
  path: "/n8n/automation-failures",
  method: "POST",
  handler: signed(async (ctx, raw) => {
    const body = parseBody(automationFailureBody, raw);
    if (!body) return json(400, { error: "invalid body" });
    await ctx.runMutation(internal.automation.recordFailure, body);
    return json(200, { ok: true });
  }),
});

export default http;
