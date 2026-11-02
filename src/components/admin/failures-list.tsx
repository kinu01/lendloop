"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { Loading } from "@/components/common/loading";
import {
  ActivityDetails,
  ActivitySummary,
} from "@/components/common/activity-details";
import { Card, CardContent } from "@/components/ui/card";
import { Hint } from "@/components/common/text";
import { timeAgo } from "@/lib/time";

export function FailuresList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listAutomationFailures,
    {},
    FIRST_PAGE,
  );
  if (status === "LoadingFirstPage") return <Loading />;
  if (results.length === 0)
    return <p className="my-4">There are no automation failures.</p>;
  return (
    <>
      <Hint>
        A failure with a run number is under Executions in n8n. A notification
        that ran out of attempts is not sent again, so tell the person yourself.
      </Hint>
      <ul className="my-4 grid gap-3">
        {results.map((failure) => (
          <li key={failure._id}>
            <Card>
              <CardContent>
                <p className="wrap-anywhere">
                  <span className="text-destructive">
                    {failure.workflow}
                    {failure.executionId
                      ? ` run ${failure.executionId}`
                      : ""}{" "}
                    failed
                  </span>
                  ,{" "}
                  <time dateTime={new Date(failure.at).toISOString()}>
                    {timeAgo(failure.at)}
                  </time>
                  .{failure.toolName ? ` Tool: ${failure.toolName}.` : ""}
                </p>
                {failure.message ? (
                  <ActivityDetails className="mt-3">
                    <ActivitySummary>Technical detail</ActivitySummary>
                    <p className="wrap-anywhere">{failure.message}</p>
                  </ActivityDetails>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <LoadMore status={status} loadMore={loadMore} label="failures" />
    </>
  );
}
