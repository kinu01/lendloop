"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorText } from "@/components/common/error-text";
import type { LoanRow } from "@/components/loans/loan-list";
import { useMutationState } from "@/hooks/use-mutation-state";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/common/row";

function ApproveButton({
  loanId,
  toolName,
  borrower,
}: {
  loanId: Id<"loans">;
  toolName: string;
  borrower: string;
}) {
  const approve = useMutation(api.loans.approve);
  const { run, pending, error } = useMutationState();
  return (
    <>
      <Button
        disabled={pending}
        aria-label={`Approve: ${toolName}`}
        onClick={() =>
          run(
            () => approve({ loanId }),
            `Approved ${toolName}. ${borrower} will be told.`,
          )
        }
      >
        {pending ? "Approving…" : "Approve"}
      </Button>
      <ErrorText message={error} />
    </>
  );
}

export function OwnerActions({
  loanId,
  toolName,
  borrower,
  status,
  hasStarted,
}: {
  loanId: Id<"loans">;
  toolName: string;
  borrower: string;
  status: LoanRow["status"];
  hasStarted: boolean;
}) {
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);

  if (status === "pending") {
    return (
      <Row>
        <ApproveButton
          loanId={loanId}
          toolName={toolName}
          borrower={borrower}
        />
        <ConfirmDialog
          label="Decline"
          subject={toolName}
          question={`Decline ${borrower}'s request for ${toolName}? ${borrower} will be told.`}
          confirmLabel="Yes, decline"
          doneMessage={`Declined. ${borrower} will be told.`}
          danger
          onConfirm={() => decline({ loanId })}
        />
      </Row>
    );
  }
  if (status === "approved" && hasStarted) {
    return (
      <ConfirmDialog
        label="Mark as returned"
        subject={toolName}
        question={`Did ${toolName} come back from ${borrower}?`}
        confirmLabel="Yes, it is back"
        doneMessage={`${toolName} is marked as returned.`}
        onConfirm={() => markReturned({ loanId })}
      />
    );
  }
  if (status === "approved") {
    return (
      <ConfirmDialog
        label="Call off this loan"
        subject={toolName}
        question={`Call off ${borrower}'s loan of ${toolName}? ${borrower} will be told.`}
        confirmLabel="Yes, call it off"
        doneMessage={`Called off. ${borrower} will be told.`}
        danger
        onConfirm={() => decline({ loanId })}
      />
    );
  }
  return null;
}

export function BorrowerActions({
  loanId,
  toolName,
  status,
  hasStarted,
}: {
  loanId: Id<"loans">;
  toolName: string;
  status: LoanRow["status"];
  hasStarted: boolean;
}) {
  const cancel = useMutation(api.loans.cancel);
  const canCancel =
    status === "pending" || (status === "approved" && !hasStarted);
  if (!canCancel) return null;
  return (
    <ConfirmDialog
      label={status === "pending" ? "Cancel request" : "Cancel loan"}
      subject={toolName}
      question={`Cancel your ${status === "pending" ? "request" : "loan"} for ${toolName}? The owner will be told.`}
      confirmLabel="Yes, cancel it"
      doneMessage="Cancelled. The owner will be told."
      onConfirm={() => cancel({ loanId })}
    />
  );
}
