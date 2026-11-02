"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { addDays, isIsoDate, rangesOverlap } from "@convex/lib/dates";
import { loanDates, type LoanDates } from "@convex/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ErrorText } from "@/components/common/error-text";
import { Hint } from "@/components/common/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMutationState } from "@/hooks/use-mutation-state";
import { firstFreeStart, localToday } from "@/lib/dates";
import { formatRange } from "@/lib/labels";

type Booking = { startDate: string; endDate: string };

const DEFAULT_LOAN_DAYS = 3;

function RequestForm({
  toolId,
  toolName,
  bookings,
  mutation,
  onDone,
  onCancel,
}: {
  toolId: Id<"tools">;
  toolName: string;
  bookings: Booking[];
  mutation: ReturnType<typeof useMutationState>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = localToday();
  const firstStart = firstFreeStart(bookings, today, DEFAULT_LOAN_DAYS);
  const request = useMutation(api.loans.request);
  const { run, pending, error } = mutation;
  const form = useForm<LoanDates>({
    resolver: zodResolver(loanDates),
    defaultValues: {
      startDate: firstStart,
      endDate: addDays(firstStart, DEFAULT_LOAN_DAYS - 1),
    },
  });
  const { startDate, endDate } = useWatch({ control: form.control });
  const { errors } = form.formState;

  const conflict =
    startDate && endDate && isIsoDate(startDate) && isIsoDate(endDate)
      ? bookings.find((booking) =>
          rangesOverlap(booking, { startDate, endDate }),
        )
      : undefined;

  const startField = form.register("startDate", {
    onChange: (event: { target: { value: string } }) => {
      const next = event.target.value;
      if (isIsoDate(next) && endDate && next > endDate)
        form.setValue("endDate", next);
    },
  });

  async function handleValid(values: LoanDates) {
    if (conflict) return;
    const sent = await run(
      () => request({ toolId, ...values }),
      `Request sent for ${toolName}. Follow it under My requests.`,
    );
    if (sent) onDone();
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleValid)}
      className="grid gap-4"
      aria-busy={pending}
      noValidate
    >
      <Field data-invalid={Boolean(errors.startDate)}>
        <FieldLabel htmlFor="request-start">From</FieldLabel>
        <Input
          id="request-start"
          type="date"
          min={today}
          aria-invalid={Boolean(errors.startDate)}
          {...startField}
        />
        <FieldError errors={[errors.startDate]} />
      </Field>
      <Field data-invalid={Boolean(errors.endDate)}>
        <FieldLabel htmlFor="request-end">To</FieldLabel>
        <Input
          id="request-end"
          type="date"
          min={startDate && isIsoDate(startDate) ? startDate : today}
          aria-invalid={Boolean(errors.endDate)}
          {...form.register("endDate")}
        />
        <FieldError errors={[errors.endDate]} />
      </Field>
      {bookings.length > 0 ? (
        <Hint>
          Already booked:{" "}
          {bookings
            .map((booking) => formatRange(booking.startDate, booking.endDate))
            .join(", ")}
          .
        </Hint>
      ) : null}
      <ErrorText
        message={
          conflict
            ? `These dates overlap a booking (${formatRange(conflict.startDate, conflict.endDate)}). Pick other dates.`
            : error
        }
      />
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || Boolean(conflict)}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RequestDialog({
  toolId,
  toolName,
  bookings,
}: {
  toolId: Id<"tools">;
  toolName: string;
  bookings: Booking[];
}) {
  const [open, setOpen] = useState(false);
  const mutation = useMutationState();

  function handleOpenChange(next: boolean) {
    if (mutation.pending) return;
    if (next) mutation.reset();
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label={`Request to borrow: ${toolName}`}>
          Request to borrow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Borrow {toolName}</DialogTitle>
          <DialogDescription>
            Choose your dates. The owner decides, and you will be told.
          </DialogDescription>
        </DialogHeader>
        <RequestForm
          toolId={toolId}
          toolName={toolName}
          bookings={bookings}
          mutation={mutation}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
