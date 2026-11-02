"use client";

import { useState } from "react";
import { ErrorText } from "@/components/common/error-text";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useMutationState } from "@/hooks/use-mutation-state";

export function ConfirmDialog({
  label,
  subject,
  question,
  confirmLabel,
  danger = false,
  doneMessage,
  onConfirm,
}: {
  label: string;
  subject: string;
  question: string;
  confirmLabel: string;
  danger?: boolean;
  doneMessage: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, error, reset } = useMutationState();
  const variant = danger ? "destructive" : "outline";

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) reset();
    setOpen(next);
  }

  async function handleConfirm() {
    if (await run(onConfirm, doneMessage)) setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} aria-label={`${label}: ${subject}`}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{question}</AlertDialogDescription>
        </AlertDialogHeader>
        <ErrorText message={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel>
          <Button variant={variant} disabled={pending} onClick={handleConfirm}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
