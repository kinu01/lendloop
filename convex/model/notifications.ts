import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LoanEvent } from "../lib/validators";

// Scheduling inside the mutation means a rolled-back change sends nothing.
export async function scheduleNotification(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  event: LoanEvent,
) {
  await ctx.scheduler.runAfter(0, internal.notify.sendRequestEvent, {
    loanId,
    event,
    changedAt: Date.now(),
    attempt: 1,
  });
}
