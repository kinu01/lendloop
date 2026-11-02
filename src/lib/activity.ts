import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type Activity = FunctionReturnType<typeof api.loans.activity>[number];
export type Viewer = "borrower" | "owner" | "admin";
type Person = "owner" | "borrower";
type Notification = Extract<Activity, { kind: "notification" }>;

const NOTICE: Record<Notification["event"], { person: Person; news: string }> =
  {
    created: { person: "owner", news: "told about this request" },
    approved: { person: "borrower", news: "told it was approved" },
    declined: { person: "borrower", news: "told it was declined" },
    cancelled: { person: "owner", news: "told it was cancelled" },
    returned: { person: "borrower", news: "told it was returned" },
  };

function problemText(activity: Notification) {
  switch (activity.problem) {
    case "http_error":
      return `HTTP ${activity.httpStatus}`;
    case "timed_out":
      return "timed out";
    default:
      return "could not reach n8n";
  }
}

function describeForAdmin(activity: Notification) {
  if (activity.problem === "not_configured")
    return "Notification not sent: the n8n webhook is not configured.";
  const person = `the ${NOTICE[activity.event].person}`;
  const problem = problemText(activity);
  return activity.willRetry
    ? `Could not tell ${person} on attempt ${activity.attempt} (${problem}); retrying.`
    : `Could not tell ${person} after ${activity.attempt} attempts (${problem}).`;
}

// Neighbors do not know our tools, so only admins see the technical cause.
function describeForNeighbor(activity: Notification, isViewer: boolean) {
  if (activity.problem === "not_configured")
    return "We could not send this update.";
  const who = isViewer ? "you" : `the ${NOTICE[activity.event].person}`;
  if (activity.willRetry)
    return `We could not tell ${who} yet. We will try again.`;
  return isViewer
    ? "We could not tell you. Please check with your neighbor."
    : `We could not tell ${who}. Please tell them yourself.`;
}

function describeNotification(activity: Notification, viewer: Viewer) {
  const { person, news } = NOTICE[activity.event];
  const isViewer = person === viewer;
  if (activity.status === "sent")
    return `${isViewer ? "You were" : `The ${person} was`} ${news}.`;
  return viewer === "admin"
    ? describeForAdmin(activity)
    : describeForNeighbor(activity, isViewer);
}

export function describeActivity(activity: Activity, viewer: Viewer): string {
  switch (activity.kind) {
    case "notification":
      return describeNotification(activity, viewer);
    case "reminder": {
      const isViewer = viewer === "borrower";
      if (activity.status === "sent")
        return isViewer ? "You were reminded." : "The borrower was reminded.";
      return isViewer
        ? "Could not remind you."
        : "Could not remind the borrower.";
    }
    case "failure":
      return "An automation run failed.";
  }
}
