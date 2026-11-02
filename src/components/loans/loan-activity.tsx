"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { describeActivity, type Activity, type Viewer } from "@/lib/activity";
import { timeAgo } from "@/lib/time";
import { Loading } from "@/components/common/loading";
import {
  ActivityDetails,
  ActivitySummary,
} from "@/components/common/activity-details";
import { Hint } from "@/components/common/text";

const TRAILING_PERIOD = /\.$/;

function History({ loanId, viewer }: { loanId: Id<"loans">; viewer: Viewer }) {
  const events = useQuery(api.loans.activity, { loanId });
  if (events === undefined) return <Loading />;
  if (events.length <= 1) {
    return <Hint>There are no earlier updates.</Hint>;
  }
  return (
    <ul className="mt-2 list-disc pl-5">
      {events.map((event) => (
        <li
          key={event._id}
          className={event.status === "failed" ? "text-destructive" : undefined}
        >
          <time dateTime={new Date(event.at).toISOString()}>
            {timeAgo(event.at)}
          </time>
          : {describeActivity(event, viewer)}
        </li>
      ))}
    </ul>
  );
}

export function LoanActivity({
  loanId,
  latest,
  viewer,
}: {
  loanId: Id<"loans">;
  latest: Activity | null;
  viewer: Viewer;
}) {
  const [open, setOpen] = useState(false);
  if (!latest) return null;
  return (
    <ActivityDetails onToggle={(event) => setOpen(event.currentTarget.open)}>
      <ActivitySummary
        className={latest.status === "failed" ? "text-destructive" : undefined}
      >
        Latest update:{" "}
        {describeActivity(latest, viewer).replace(TRAILING_PERIOD, "")},{" "}
        {timeAgo(latest.at)}
      </ActivitySummary>
      {open ? <History loanId={loanId} viewer={viewer} /> : null}
    </ActivityDetails>
  );
}
