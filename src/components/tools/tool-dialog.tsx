"use client";

import { toolInput, type ToolInput } from "@convex/lib/schemas";
import {
  CATEGORIES,
  CONDITIONS,
  DESCRIPTION_MAX,
  NAME_MAX,
} from "@convex/lib/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ErrorText } from "@/components/common/error-text";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useMutationState } from "@/hooks/use-mutation-state";
import { capitalize } from "@/lib/labels";

const EMPTY: ToolInput = {
  name: "",
  category: "power tools",
  condition: "good",
  description: "",
};

function toFormValues(tool: ToolInput): ToolInput {
  return {
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
  };
}

export function ToolDialog({
  trigger,
  initial = EMPTY,
  title,
  description,
  submitLabel,
  doneMessage,
  onSubmit,
}: {
  trigger: ReactNode;
  initial?: ToolInput;
  title: string;
  description: string;
  submitLabel: string;
  doneMessage: (name: string) => string;
  onSubmit: (fields: ToolInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const { run, pending, error, reset } = useMutationState();
  const form = useForm<ToolInput>({
    resolver: zodResolver(toolInput),
    defaultValues: toFormValues(initial),
  });
  const typedDescription = useWatch({
    control: form.control,
    name: "description",
  });
  const { errors, isDirty } = form.formState;

  function handleOpenChange(next: boolean) {
    if (next) {
      reset();
      form.reset(toFormValues(initial));
      setOpen(true);
    } else if (!pending) {
      if (isDirty) setConfirmingDiscard(true);
      else setOpen(false);
    }
  }

  function discard() {
    setConfirmingDiscard(false);
    setOpen(false);
  }

  async function handleValid(values: ToolInput) {
    const saved = await run(() => onSubmit(values), doneMessage(values.name));
    if (saved) setOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(handleValid)}
            className="grid gap-4"
            aria-busy={pending}
            noValidate
          >
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="tool-name">Name</FieldLabel>
              <Input
                id="tool-name"
                autoComplete="off"
                maxLength={NAME_MAX}
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="tool-category">Category</FieldLabel>
                <NativeSelect
                  id="tool-category"
                  className="w-full"
                  {...form.register("category")}
                >
                  {CATEGORIES.map((category) => (
                    <NativeSelectOption key={category} value={category}>
                      {capitalize(category)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="tool-condition">Condition</FieldLabel>
                <NativeSelect
                  id="tool-condition"
                  className="w-full"
                  {...form.register("condition")}
                >
                  {CONDITIONS.map((condition) => (
                    <NativeSelectOption key={condition} value={condition}>
                      {capitalize(condition)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="tool-description">
                Short description
              </FieldLabel>
              <Textarea
                id="tool-description"
                rows={3}
                maxLength={DESCRIPTION_MAX}
                aria-describedby="tool-description-hint"
                aria-invalid={Boolean(errors.description)}
                {...form.register("description")}
              />
              <FieldDescription id="tool-description-hint">
                {DESCRIPTION_MAX - (typedDescription?.length ?? 0)} of{" "}
                {DESCRIPTION_MAX} characters left.
              </FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
            <ErrorText message={error} />
            <DialogFooter>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              What you typed will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button variant="destructive" onClick={discard}>
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
