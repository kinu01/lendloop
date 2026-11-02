"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { ErrorText } from "@/components/common/error-text";
import { Switch } from "@/components/ui/switch";
import { useMutationState } from "@/hooks/use-mutation-state";

export function TrustedToggle({
  userId,
  name,
  trusted,
}: {
  userId: Id<"users">;
  name: string;
  trusted: boolean;
}) {
  const setTrusted = useMutation(api.admin.setTrustedLender);
  const { run, pending, error } = useMutationState();
  return (
    <>
      <Switch
        checked={trusted}
        disabled={pending}
        aria-label={`Trusted Lender: ${name}`}
        onCheckedChange={(next) =>
          run(
            () => setTrusted({ userId, trusted: next }),
            next
              ? `${name} is now a Trusted Lender.`
              : `${name} is no longer a Trusted Lender.`,
          )
        }
      />
      <ErrorText message={error} />
    </>
  );
}
