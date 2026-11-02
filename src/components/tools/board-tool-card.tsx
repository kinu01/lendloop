"use client";

import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { RequestDialog } from "@/components/tools/request-dialog";
import { AvailabilityBadge } from "@/components/common/status-badge";
import { TrustedBadge } from "@/components/common/trusted-badge";
import { Hint } from "@/components/common/text";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TextLink } from "@/components/common/text-link";
import { capitalize, formatDate, formatRange } from "@/lib/labels";

type Tool = FunctionReturnType<typeof api.tools.list>["page"][number];

export function BoardToolCard({ tool }: { tool: Tool }) {
  return (
    <li className="flex">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <h2>{tool.name}</h2>
          </CardTitle>
          <CardDescription>
            {capitalize(tool.category)} · {capitalize(tool.condition)} condition
          </CardDescription>
          <CardAction>
            <AvailabilityBadge availability={tool.availability} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid flex-1 content-start gap-2">
          {tool.description ? (
            <p className="wrap-anywhere">{tool.description}</p>
          ) : null}
          {tool.dueBack ? (
            <Hint>Due back {formatDate(tool.dueBack)}</Hint>
          ) : null}
          {tool.nextBooking ? (
            <Hint>
              {tool.availability === "available" ? "Free now. " : ""}
              Next booking:{" "}
              {formatRange(
                tool.nextBooking.startDate,
                tool.nextBooking.endDate,
              )}
            </Hint>
          ) : null}
          <p className="text-muted-foreground">
            Lent by {tool.isMine ? "you" : tool.ownerFirstName}{" "}
            {tool.ownerIsTrustedLender ? <TrustedBadge /> : null}
          </p>
        </CardContent>
        {tool.isMine ? null : (
          <CardFooter className="flex-wrap gap-2">
            {tool.myPendingRequest ? (
              <p className="font-semibold text-success">
                You asked for{" "}
                {formatRange(
                  tool.myPendingRequest.startDate,
                  tool.myPendingRequest.endDate,
                )}
                . See <TextLink href="/requests">My requests</TextLink>.
              </p>
            ) : (
              <RequestDialog
                toolId={tool._id}
                toolName={tool.name}
                bookings={tool.bookings}
              />
            )}
          </CardFooter>
        )}
      </Card>
    </li>
  );
}
