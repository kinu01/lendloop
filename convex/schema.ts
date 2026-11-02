import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  category,
  condition,
  deliveryStatus,
  loanStatus,
  notificationFacts,
  reminderStatus,
  role,
} from "./lib/validators";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.string(),
    role,
    isTrustedLender: v.boolean(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category,
    condition,
    description: v.string(),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
  })
    .index("by_owner_removed", ["ownerId", "removedAt"])
    .index("by_removed", ["removedAt"])
    .index("by_category_removed", ["category", "removedAt"]),

  loans: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    ownerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatus,
    closedAt: v.optional(v.number()),
  })
    // Not a duplicate of by_borrower_status: this one lists a borrower's loans newest first.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_borrower", ["borrowerId"])
    .index("by_borrower_status", ["borrowerId", "status"])
    .index("by_owner_status", ["ownerId", "status", "endDate"])
    .index("by_owner_closed", ["ownerId", "closedAt"])
    .index("by_tool_status", ["toolId", "status", "borrowerId"])
    .index("by_status_end", ["status", "endDate"]),

  reminders: defineTable({
    loanId: v.id("loans"),
    reminderDate: v.string(),
    status: reminderStatus,
    runId: v.string(),
  }).index("by_loan_date", ["loanId", "reminderDate"]),

  automationEvents: defineTable(
    v.union(
      v.object({
        kind: v.literal("notification"),
        needsAdmin: v.optional(v.literal(true)),
        ...notificationFacts,
      }),
      v.object({
        kind: v.literal("reminder"),
        needsAdmin: v.optional(v.literal(true)),
        loanId: v.id("loans"),
        status: deliveryStatus,
      }),
      v.object({
        kind: v.literal("failure"),
        needsAdmin: v.optional(v.literal(true)),
        loanId: v.optional(v.id("loans")),
        workflow: v.string(),
        executionId: v.string(),
        message: v.string(),
      }),
    ),
  )
    .index("by_loan", ["loanId"])
    .index("by_needs_admin", ["needsAdmin"])
    .index("by_failure_run", ["workflow", "executionId"]),
});
