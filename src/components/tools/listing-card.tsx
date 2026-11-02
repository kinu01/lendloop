"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { AvailabilityBadge } from "@/components/common/status-badge";
import { ToolDialog } from "@/components/tools/tool-dialog";
import { Hint } from "@/components/common/text";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { capitalize, formatRange, hasOpenLoan } from "@/lib/labels";

type Listing = FunctionReturnType<typeof api.tools.myListings>["page"][number];

export function ListingCard({ tool }: { tool: Listing }) {
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const locked = hasOpenLoan(tool);

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
          {tool.nextBooking ? (
            <Hint>
              Next booking:{" "}
              {formatRange(
                tool.nextBooking.startDate,
                tool.nextBooking.endDate,
              )}
            </Hint>
          ) : null}
          {locked ? (
            <Hint>You can remove this tool after its loans end.</Hint>
          ) : null}
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2">
          <ToolDialog
            trigger={
              <Button variant="outline" aria-label={`Edit: ${tool.name}`}>
                Edit
              </Button>
            }
            initial={tool}
            title={`Edit ${tool.name}`}
            description="Your changes show on the board right away."
            submitLabel="Save changes"
            doneMessage={(name) => `${name} is saved.`}
            onSubmit={(fields) => update({ toolId: tool._id, ...fields })}
          />
          {locked ? null : (
            <ConfirmDialog
              label="Remove"
              subject={tool.name}
              question={`Remove ${tool.name}? Pending requests for it will be declined.`}
              confirmLabel="Yes, remove"
              doneMessage={`${tool.name} is removed.`}
              danger
              onConfirm={() => remove({ toolId: tool._id })}
            />
          )}
        </CardFooter>
      </Card>
    </li>
  );
}
