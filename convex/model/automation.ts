import type { Doc } from "../_generated/dataModel";

type AutomationEvent = Doc<"automationEvents">;

function describeProblem(
  event: Extract<AutomationEvent, { kind: "notification" }>,
) {
  switch (event.problem) {
    case "not_configured":
      return "the n8n webhook is not configured";
    case "http_error":
      return `n8n answered HTTP ${event.httpStatus}`;
    case "timed_out":
      return "n8n timed out";
    default:
      return "n8n could not be reached";
  }
}

export function describeFailure(event: AutomationEvent): {
  workflow: string;
  executionId: string | null;
  message: string;
} {
  switch (event.kind) {
    case "failure":
      return {
        workflow: event.workflow,
        executionId: event.executionId,
        message: event.message,
      };
    case "notification":
      return {
        workflow: "LendLoop: request notification",
        executionId: null,
        message: `The ${event.event} notification was not sent after ${event.attempt} attempts: ${describeProblem(event)}.`,
      };
    case "reminder":
      return {
        workflow: "LendLoop: overdue reminders",
        executionId: null,
        message: "The reminder was not sent. The next run tries again.",
      };
  }
}
