import { v } from "convex/values";

export const CATEGORIES = [
  "power tools",
  "hand tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;

export const CONDITIONS = ["new", "good", "fair", "worn"] as const;

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const PUBLIC_LIST_SIZE = 24;
export const WAITING_COUNT_LIMIT = 100;

export const category = v.union(...CATEGORIES.map((c) => v.literal(c)));
export const condition = v.union(...CONDITIONS.map((c) => v.literal(c)));

export const role = v.union(v.literal("user"), v.literal("admin"));

export const loanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export const loanEvent = v.union(
  v.literal("created"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
export type LoanEvent = typeof loanEvent.type;

export const deliveryStatus = v.union(v.literal("sent"), v.literal("failed"));

export const reminderStatus = v.union(
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
);

export const deliveryProblem = v.union(
  v.literal("not_configured"),
  v.literal("timed_out"),
  v.literal("unreachable"),
  v.literal("http_error"),
);
export type DeliveryProblem = typeof deliveryProblem.type;

export const notificationFacts = {
  loanId: v.id("loans"),
  event: loanEvent,
  status: deliveryStatus,
  attempt: v.number(),
  willRetry: v.boolean(),
  problem: v.optional(deliveryProblem),
  httpStatus: v.optional(v.number()),
};
